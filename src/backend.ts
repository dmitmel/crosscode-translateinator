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

export interface FieldsSelectionFilter<F> {
  except?: Array<keyof F> | null;
}

export function fields_selection<F>(
  base_fields: ReadonlyArray<keyof F>,
  options: FieldsSelectionFilter<F>,
): ReadonlyArray<keyof F> {
  let fields = base_fields.slice();
  if (options.except != null) {
    for (let field of options.except) {
      let idx = fields.indexOf(field);
      if (idx >= 0) fields.splice(idx, 1);
    }
  }
  return base_fields;
}

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

export namespace ListedFragmentFields {
  export const ALL: ReadonlyArray<keyof ListedFragmentFields> = [
    'id',
    'tr_file_path',
    'game_file_path',
    'json_path',
    'lang_uid',
    'description',
    'original_text',
    'flags',
    'translations',
    'comments',
  ];
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

export namespace ListedTranslationFields {
  export const ALL: ReadonlyArray<keyof ListedTranslationFields> = [
    'id',
    'author_username',
    'editor_username',
    'creation_timestamp',
    'modification_timestamp',
    'text',
    'flags',
  ];
}

export interface ListedCommentFields {
  id: string;
  author_username: string;
  editor_username: string;
  creation_timestamp: number;
  modification_timestamp: number;
  text: string;
}

export namespace ListedCommentFields {
  export const ALL: ReadonlyArray<keyof ListedCommentFields> = [
    'id',
    'author_username',
    'editor_username',
    'creation_timestamp',
    'modification_timestamp',
    'text',
  ];
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
