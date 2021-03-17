import { Event2 } from './events';
import * as utils from './utils';
import * as crosslocale_bridge from './backend/ffi_bridge';

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

  public events = {
    error: new Event2<[error: Error]>(),
    connected: new Event2(),
    disconnected: new Event2(),
  };

  // eslint-disable-next-line @typescript-eslint/require-await
  public async connect(): Promise<void> {
    if (!(this.state === BackendState.DISCONNECTED)) {
      throw new Error('Assertion failed: this.state === BackendState.DISCONNECTED');
    }

    this.state = BackendState.DISCONNECTED;

    this.transport = new crosslocale_bridge.Backend();
    void this.run_message_receiver_loop();

    this.state = BackendState.CONNECTED;
    this.events.connected.fire();
  }

  private async run_message_receiver_loop(): Promise<void> {
    while (true) {
      let message: string;
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
      this.recv_message_internal(message);
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async send_message_internal(message: Message): Promise<void> {
    if (!(this.state !== BackendState.DISCONNECTED)) {
      throw new Error('Assertion failed: this.state !== BackendState.DISCONNECTED');
    }

    let text = JSON.stringify(message);
    this.transport.send_message(text);
  }

  private recv_message_internal(text: string): void {
    if (!(this.state !== BackendState.DISCONNECTED)) {
      throw new Error('Assertion failed: this.state !== BackendState.DISCONNECTED');
    }

    let message: Message = JSON.parse(text);
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
        this.events.error.fire(error);
        if (message.id != null) {
          let callback = this.sent_request_error_callbacks.get(message.id);
          if (callback == null) {
            throw new Error('server has sent an error response to an unknown message');
          }
          callback(error);
        }
        break;
      }
    }
  }

  public async send_request<T extends RequestMessageType['type'] & ResponseMessageType['type']>(
    data: RequestMessageType & { type: T },
  ): Promise<ResponseMessageType & { type: T }> {
    if (!(this.state !== BackendState.DISCONNECTED)) {
      throw new Error('Assertion failed: this.state !== BackendState.DISCONNECTED');
    }

    this.current_request_id = Math.max(this.current_request_id, 1);
    let id = this.current_request_id;
    this.current_request_id = utils.u32(this.current_request_id + 1);

    let response_promise = new Promise<ResponseMessageType>((resolve, reject) => {
      this.sent_request_success_callbacks.set(id, resolve);
      this.sent_request_error_callbacks.set(id, reject);
    });
    await this.send_message_internal({ type: 'req', id, data });
    return (response_promise as unknown) as ResponseMessageType & { type: T };
  }

  public disconnect(): void {
    if (this.state === BackendState.DISCONNECTED) return;

    this.transport.close();
    this.transport = null!;

    this.events.disconnected.fire();
  }
}
