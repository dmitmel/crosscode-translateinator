import * as crosslocale_bridge from './backend/ffi_bridge';
import { Event2 } from './events';
import * as utils from './utils';

crosslocale_bridge.init_logging();

export const PROTOCOL_VERSION = 0;
if (crosslocale_bridge.PROTOCOL_VERSION !== PROTOCOL_VERSION) {
  throw new Error('Unsupported protocol version!');
}

export type Message = RequestMessage | ResponseMessage | ErrorResponseMessage;

export const enum MessageType {
  Request = 1,
  Response = 2,
  ErrorResponse = 3,
}

export type RequestMessage<M extends keyof MessageRegistry = keyof MessageRegistry> = [
  type: MessageType.Request,
  id: number,
  method: M,
  data: MessageRegistry[M]['request'],
];

export type ResponseMessage<M extends keyof MessageRegistry = keyof MessageRegistry> = [
  type: MessageType.Response,
  id: number,
  data: MessageRegistry[M]['response'],
];

export type ErrorResponseMessage = [
  type: MessageType.ErrorResponse,
  id: number | null,
  message: string,
];

type Empty = Record<string, never>;

export interface MessageRegistry {
  //

  get_backend_info: {
    request: Empty;
    response: { implementation_name: string; implementation_version: string };
  };

  open_project: {
    request: { dir: string };
    response: { project_id: number };
  };

  close_project: {
    request: { project_id: number };
    response: Empty;
  };

  get_project_meta: {
    request: { project_id: number };
    response: {
      root_dir: string;
      id: string;
      creation_timestamp: number;
      modification_timestamp: number;
      game_version: string;
      original_locale: string;
      reference_locales: string[];
      translation_locale: string;
      translations_dir: string;
      splitter: string;
    };
  };

  list_files: {
    request: {
      project_id: number;
      file_type: 'tr_file' | 'game_file';
    };
    response: {
      paths: string[];
    };
  };

  query_fragments: {
    request: {
      project_id: number;
      from_tr_file?: string | null;
      from_game_file?: string | null;
      slice_start?: number | null;
      slice_end?: number | null;
      json_paths?: string[] | null;
      select_fields: FieldsSelection;
      only_count?: boolean | null;
    };
    response: {
      fragments: unknown[][];
    };
  };

  //
}

export type RequestMessageType = {
  [K in keyof MessageRegistry]: { type: K } & MessageRegistry[K]['request'];
}[keyof MessageRegistry];

export type ResponseMessageType = {
  [K in keyof MessageRegistry]: { type: K } & MessageRegistry[K]['response'];
}[keyof MessageRegistry];

export interface ListedFragmentFields {
  id: string;
  tr_file_path: string;
  game_file_path: string;
  json_path: string;
  lang_uid: number;
  description: string[];
  original_text: string;
  flags: string[];
  translations: ListedTranslationFields[];
  comments: ListedCommentFields[];
}

export interface ListedTranslationFields {
  id: string;
  author_username: string;
  editor_username: string;
  creation_timestamp: number;
  modification_timestamp: number;
  text: string;
  flags: string[];
}

export interface ListedCommentFields {
  id: string;
  author_username: string;
  editor_username: string;
  creation_timestamp: number;
  modification_timestamp: number;
  text: string;
}

export interface TableDataTypes {
  fragments: ListedFragmentFields;
  translations: ListedTranslationFields;
  comments: ListedCommentFields;
}

export type FieldsSelection = {
  [K in keyof TableDataTypes]?: ReadonlyArray<keyof TableDataTypes[K]>;
};

export function expand_table_data<T extends keyof TableDataTypes>(
  table_type: T,
  table_data: unknown[][],
  select_fields: FieldsSelection,
): Array<TableDataTypes[T] | null | undefined> {
  let expanded_data: unknown[] = [];
  if (utils.has_key(select_fields, table_type)) {
    let requested_columns = select_fields[table_type]!;
    for (let i = 0, len = table_data.length; i < len; i++) {
      let row = table_data[i];
      if (row == null) {
        expanded_data.push(row);
        continue;
      }
      let row_obj = {} as Record<string, unknown>;
      for (let j = 0, len = requested_columns.length; j < len; j++) {
        let column_name = requested_columns[j];
        let column = row[j];
        if (utils.has_key(select_fields, column_name)) {
          column = expand_table_data(
            column_name as keyof TableDataTypes,
            column as unknown[][],
            select_fields,
          );
        }
        row_obj[column_name] = column;
      }
      expanded_data.push(row_obj);
    }
  } else {
    expanded_data = table_data;
  }
  return expanded_data as Array<TableDataTypes[T]>;
}

export enum BackendState {
  DISCONNECTED,
  CONNECTED,
}

export class Backend {
  private transport: crosslocale_bridge.Backend = null!;
  private state = BackendState.DISCONNECTED;
  private current_request_id = 1;
  private sent_request_success_callbacks = new Map<number, (data: unknown) => void>();
  private sent_request_error_callbacks = new Map<number, (error: Error) => void>();

  public event_error = new Event2<[request_id: number | null, error: Error]>();
  public event_connected = new Event2();
  public event_disconnected = new Event2();

  // eslint-disable-next-line @typescript-eslint/require-await
  public async connect(): Promise<void> {
    utils.assert(this.state === BackendState.DISCONNECTED);
    this.state = BackendState.DISCONNECTED;

    this.transport = new crosslocale_bridge.Backend();
    void this.run_message_receiver_loop();

    this.state = BackendState.CONNECTED;
    this.event_connected.fire();
  }

  private async run_message_receiver_loop(): Promise<void> {
    while (true) {
      let message: Buffer;
      try {
        message = await new Promise<Buffer>((resolve, reject) => {
          this.transport.recv_message((err, message) => {
            if (err != null) reject(err);
            else resolve(message);
          });
        });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'CROSSLOCALE_ERR_BACKEND_DISCONNECTED') {
          break;
        }
        throw e;
      }
      try {
        this.recv_message_internal(message);
      } catch (e) {
        console.error(e);
      }
    }
    // NOTE: Explicit disconnection at this point **is not needed** because
    // recv_message has already thrown an exception due to a disconnection!
  }

  private send_message_internal(message: Message): void {
    utils.assert(this.state !== BackendState.DISCONNECTED);
    let text = JSON.stringify(message);
    this.transport.send_message(Buffer.from(text, 'utf8'));
  }

  private recv_message_internal(text: Buffer): void {
    utils.assert(this.state !== BackendState.DISCONNECTED);
    let message: Message = JSON.parse(text.toString('utf8'));
    let [msg_type] = message;
    switch (msg_type) {
      case MessageType.Request: {
        throw new Error('unexpected request from the backend');
      }

      case MessageType.Response: {
        let [_, msg_id, msg_params] = message as ResponseMessage;
        let callback = this.sent_request_success_callbacks.get(msg_id);
        if (callback == null) {
          throw new Error('server has sent a response to an unknown message');
        }
        callback(msg_params);
        break;
      }

      case MessageType.ErrorResponse: {
        let [_, msg_id, err_msg] = message as ErrorResponseMessage;
        let error = new Error(err_msg);
        this.event_error.fire(msg_id, error);
        if (msg_id != null) {
          let callback = this.sent_request_error_callbacks.get(msg_id);
          if (callback == null) {
            throw new Error('server has sent an error response to an unknown message');
          }
          callback(error);
        }
        break;
      }

      default: {
        throw new Error('unexpected message type from the backend');
      }
    }
  }

  public async send_request<M extends keyof MessageRegistry>(
    method: M,
    params: MessageRegistry[M]['request'],
  ): Promise<MessageRegistry[M]['response']> {
    utils.assert(this.state !== BackendState.DISCONNECTED);

    this.current_request_id = Math.max(this.current_request_id, 1);
    let id = this.current_request_id;
    this.current_request_id = utils.u32(this.current_request_id + 1);

    try {
      let response_promise = new Promise<unknown>((resolve, reject) => {
        this.sent_request_success_callbacks.set(id, resolve);
        this.sent_request_error_callbacks.set(id, reject);
      });
      this.send_message_internal([MessageType.Request, id, method, params]);
      return (await response_promise) as MessageRegistry[M]['response'];
    } finally {
      this.sent_request_success_callbacks.delete(id);
      this.sent_request_error_callbacks.delete(id);
    }
  }

  public disconnect(): void {
    if (this.state === BackendState.DISCONNECTED) return;

    this.transport.close();
    this.transport = null!;

    this.event_disconnected.fire();
  }
}

export class Project {
  public static async open(backend: Backend, dir: string): Promise<Project> {
    let res = await backend.send_request('open_project', { dir });
    return new Project(backend, dir, res.project_id);
  }

  public constructor(public backend: Backend, public dir: string, public id: number) {}

  public async get_meta(): Promise<ProjectMeta> {
    let res = await this.backend.send_request('get_project_meta', {
      project_id: this.id,
    });
    return new ProjectMeta(
      this,
      res.root_dir,
      res.id,
      new Date(res.creation_timestamp * 1000),
      new Date(res.modification_timestamp * 1000),
      res.game_version,
      res.original_locale,
      res.reference_locales,
      res.translation_locale,
      res.translations_dir,
      res.splitter,
    );
  }

  public async list_tr_file_paths(): Promise<string[]> {
    let res = await this.backend.send_request('list_files', {
      project_id: this.id,
      file_type: 'tr_file',
    });
    return res.paths;
  }

  public async list_game_file_paths(): Promise<string[]> {
    let res = await this.backend.send_request('list_files', {
      project_id: this.id,
      file_type: 'game_file',
    });
    return res.paths;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async get_virtual_game_file(path: string): Promise<VirtualGameFile> {
    return new VirtualGameFile(this, path);
  }

  public _create_fragment(f_raw: ListedFragmentFields): Fragment {
    let f = new Fragment(
      this,
      f_raw.id,
      f_raw.tr_file_path,
      f_raw.game_file_path,
      f_raw.json_path,
      f_raw.lang_uid,
      f_raw.description,
      f_raw.original_text,
      new Set(f_raw.flags),
      [],
      [],
    );
    f.translations = f_raw.translations.map((tr_raw) => {
      return new Translation(
        f,
        tr_raw.id,
        tr_raw.author_username,
        tr_raw.editor_username,
        new Date(tr_raw.creation_timestamp * 1000),
        new Date(tr_raw.modification_timestamp * 1000),
        tr_raw.text,
        new Set(tr_raw.flags),
      );
    });
    return f;
  }
}

export class ProjectMeta {
  public constructor(
    public project: Project,
    public root_dir: string,
    public id: string,
    public creation_timestamp: Date,
    public modification_timestamp: Date,
    public game_version: string,
    public original_locale: string,
    public reference_locales: string[],
    public translation_locale: string,
    public translations_dir: string,
    public splitter: string,
  ) {}
}

export class TrFile {
  public constructor(public project: Project, public path: string) {}
}

export class VirtualGameFile {
  public constructor(public project: Project, public path: string) {}

  public async list_fragments(start?: number | null, end?: number | null): Promise<Fragment[]> {
    let select_fields: FieldsSelection = {
      fragments: [
        'id',
        'tr_file_path',
        'json_path',
        'lang_uid',
        'description',
        'original_text',
        'flags',
        'translations',
      ],
      translations: [
        'id',
        'author_username',
        'editor_username',
        'creation_timestamp',
        'modification_timestamp',
        'text',
        'flags',
      ],
    };
    let res = await this.project.backend.send_request('query_fragments', {
      project_id: this.project.id,
      from_game_file: this.path,
      slice_start: start,
      slice_end: end,
      select_fields,
    });
    return expand_table_data('fragments', res.fragments, select_fields).map((f_raw) => {
      return this.project._create_fragment({
        ...f_raw!,
        game_file_path: this.path,
      });
    });
  }

  public async get_fragment(json_path: string): Promise<Fragment | null> {
    let select_fields: FieldsSelection = {
      fragments: [
        'id',
        'tr_file_path',
        'lang_uid',
        'description',
        'original_text',
        'flags',
        'translations',
      ],
      translations: [
        'id',
        'author_username',
        'editor_username',
        'creation_timestamp',
        'modification_timestamp',
        'text',
        'flags',
      ],
    };
    let res = await this.project.backend.send_request('query_fragments', {
      project_id: this.project.id,
      from_game_file: this.path,
      json_paths: [json_path],
      select_fields,
    });
    let [f_raw] = expand_table_data('fragments', res.fragments, select_fields);
    if (f_raw == null) return null;
    return this.project._create_fragment({
      ...f_raw,
      game_file_path: this.path,
      json_path,
    });
  }
}

export class Fragment {
  public constructor(
    public project: Project,
    public id: string,
    public tr_file_path: string,
    public game_file_path: string,
    public json_path: string,
    public lang_uid: number,
    public description: string[],
    public original_text: string,
    public flags: Set<string>,
    public translations: Translation[],
    public comments: Comment[],
  ) {}

  public has_lang_uid(): boolean {
    return this.lang_uid !== 0;
  }
}

export class Translation {
  public constructor(
    public fragment: Fragment,
    public id: string,
    public author_username: string,
    public editor_username: string,
    public creation_timestamp: Date,
    public modification_timestamp: Date,
    public text: string,
    public flags: Set<string>,
  ) {}
}
