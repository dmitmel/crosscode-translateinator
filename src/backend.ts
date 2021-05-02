import * as crosslocale_bridge from './backend/ffi_bridge';
import { Event2 } from './events';
import * as utils from './utils';

crosslocale_bridge.init_logging();

export const PROTOCOL_VERSION = 0;
if (crosslocale_bridge.PROTOCOL_VERSION !== PROTOCOL_VERSION) {
  throw new Error('Unsupported protocol version!');
}

export type Message = RequestMessage | ResponseMessage | ErrorResponseMessage;

export interface RequestMessage {
  type: 'req';
  id: number;
  data: RequestMessageType;
}

export interface ResponseMessage {
  type: 'res';
  id: number;
  data: ResponseMessageType;
}

export interface ErrorResponseMessage {
  type: 'err';
  id?: number | null;
  message: string;
}

export type RequestMessageType =
  | { type: 'Backend/info' }
  | { type: 'Project/open'; dir: string }
  | { type: 'Project/close'; project_id: number }
  | { type: 'Project/get_meta'; project_id: number }
  | { type: 'Project/list_tr_files'; project_id: number }
  | { type: 'Project/list_virtual_game_files'; project_id: number }
  | {
      type: 'VirtualGameFile/list_fragments';
      project_id: number;
      file_path: string;
      start?: number | null;
      end?: number | null;
    };

export type ResponseMessageType =
  | { type: 'ok' }
  | { type: 'Backend/info'; implementation_name: string; implementation_version: string }
  | { type: 'Project/open'; project_id: number }
  | {
      type: 'Project/get_meta';
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
    }
  | { type: 'Project/list_tr_files'; paths: string[] }
  | { type: 'Project/list_virtual_game_files'; paths: string[] }
  | { type: 'VirtualGameFile/list_fragments'; fragments: ListedFragment[] };

export interface ListedFragment {
  id: string;
  json: string;
  luid?: number | null;
  desc?: string[] | null;
  orig: string;
  flags?: string[] | null;
  tr?: ListedTranslation[] | null;
  cm?: ListedComment[] | null;
}

export interface ListedTranslation {
  id: string;
  author: string;
  editor: string;
  ctime: number;
  mtime: number;
  text: string;
  flags?: string[] | null;
}

export interface ListedComment {
  id: string;
  author: string;
  editor: string;
  ctime: number;
  mtime: number;
  text: string;
}

export enum BackendState {
  DISCONNECTED,
  CONNECTED,
}

export class Backend {
  private transport: crosslocale_bridge.Backend = null!;
  private state = BackendState.DISCONNECTED;
  private current_request_id = 1;
  private sent_request_success_callbacks = new Map<number, (data: ResponseMessageType) => void>();
  private sent_request_error_callbacks = new Map<number, (error: Error) => void>();

  public event_error = new Event2<[error: Error]>();
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
        message = await new Promise((resolve, reject) => {
          this.transport.recv_message((err, message) => {
            if (err != null) reject(err);
            else resolve(message);
          });
        });
      } catch (e) {
        if (e.code === 'CROSSLOCALE_ERR_BACKEND_DISCONNECTED') {
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
    // this.transport.send_message(Buffer.from(text, 'utf8'));
    this.transport.send_message(text);
  }

  private recv_message_internal(text: Buffer): void {
    utils.assert(this.state !== BackendState.DISCONNECTED);
    let message: Message = JSON.parse(text.toString('utf8'));
    switch (message.type) {
      case 'req': {
        throw new Error('unexpected request from the backend');
      }

      case 'res': {
        let callback = this.sent_request_success_callbacks.get(message.id);
        if (callback == null) {
          throw new Error('server has sent a response to an unknown message');
        }
        callback(message.data);
        break;
      }

      case 'err': {
        let error = new Error(message.message);
        this.event_error.fire(error);
        if (message.id != null) {
          let callback = this.sent_request_error_callbacks.get(message.id);
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

  public async send_request(data: RequestMessageType): Promise<ResponseMessageType> {
    utils.assert(this.state !== BackendState.DISCONNECTED);

    this.current_request_id = Math.max(this.current_request_id, 1);
    let id = this.current_request_id;
    this.current_request_id = utils.u32(this.current_request_id + 1);

    try {
      let response_promise = new Promise<ResponseMessageType>((resolve, reject) => {
        this.sent_request_success_callbacks.set(id, resolve);
        this.sent_request_error_callbacks.set(id, reject);
      });
      this.send_message_internal({ type: 'req', id, data });
      return await response_promise;
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
    let res = await backend.send_request({ type: 'Project/open', dir });
    utils.assert(res.type === 'Project/open');
    return new Project(backend, dir, res.project_id);
  }

  public constructor(public backend: Backend, public dir: string, public id: number) {}

  public async get_meta(): Promise<ProjectMeta> {
    let res = await this.backend.send_request({ type: 'Project/get_meta', project_id: this.id });
    utils.assert(res.type === 'Project/get_meta');
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

  public async list_tr_files(): Promise<TrFile[]> {
    let res = await this.backend.send_request({
      type: 'Project/list_tr_files',
      project_id: this.id,
    });
    utils.assert(res.type === 'Project/list_tr_files');
    return res.paths.map((path) => new TrFile(this, path));
  }

  public async list_virtual_game_files(): Promise<VirtualGameFile[]> {
    let res = await this.backend.send_request({
      type: 'Project/list_virtual_game_files',
      project_id: this.id,
    });
    utils.assert(res.type === 'Project/list_virtual_game_files');
    return res.paths.map((path) => new VirtualGameFile(this, path));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async get_virtual_game_file(path: string): Promise<VirtualGameFile> {
    return new VirtualGameFile(this, path);
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

  public async list_fragments(
    range?: { start?: number | null; end?: number | null } | null,
  ): Promise<Fragment[]> {
    let res = await this.project.backend.send_request({
      type: 'VirtualGameFile/list_fragments',
      project_id: this.project.id,
      file_path: this.path,
      start: range?.start,
      end: range?.end,
    });
    utils.assert(res.type === 'VirtualGameFile/list_fragments');
    return res.fragments.map((f_raw) => {
      let f = new Fragment(
        this.project,
        f_raw.id,
        this.path,
        f_raw.json,
        f_raw.luid ?? 0,
        f_raw.desc ?? [],
        f_raw.orig,
        new Set(f_raw.flags ?? []),
        [],
        [],
      );
      for (let tr_raw of f_raw.tr ?? []) {
        f.translations.push(
          new Translation(
            f,
            tr_raw.id,
            tr_raw.author,
            tr_raw.editor,
            new Date(tr_raw.ctime * 1000),
            new Date(tr_raw.mtime * 1000),
            tr_raw.text,
            new Set(tr_raw.flags ?? []),
          ),
        );
      }
      return f;
    });
  }
}

export class Fragment {
  public constructor(
    public project: Project,
    public id: string,
    public file_path: string,
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
