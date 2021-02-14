import stream_binary_split from 'binary-split';
import * as subprocess from 'child_process';
import * as stream from 'stream';
import { Event2 } from './events';
import * as utils from './utils';

export const PROTOCOL_VERSION = 0;

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
  id: number;
  message: string;
}

export type RequestMessageType =
  | { type: 'handshake'; protocol_version: number }
  | { type: 'Project/open'; dir: string }
  | { type: 'Project/close'; id: number };

export type ResponseMessageType =
  | { type: 'ok' }
  | {
      type: 'handshake';
      protocol_version: number;
      implementation_name: string;
      implementation_version: string;
    }
  | { type: 'Project/open'; id: number };

type BackendSubprocess = subprocess.ChildProcessByStdio<
  stream.Writable, // stdin
  stream.Readable, // stdout
  stream.Readable // stderr
>;

export enum BackendState {
  DISCONNECTED,
  HANDSHAKE,
  CONNECTED,
}

export class Backend {
  private proc: BackendSubprocess = null!;
  private state = BackendState.DISCONNECTED;
  private current_request_id = 1;
  private sent_request_success_callbacks = new Map<number, (data: ResponseMessageType) => void>();
  private sent_request_error_callbacks = new Map<number, (error: Error) => void>();

  public events = {
    error: new Event2<[error: Error]>(),
    connected: new Event2(),
    disconnected: new Event2(),
  };

  public async connect(): Promise<void> {
    if (!(this.state === BackendState.DISCONNECTED)) {
      throw new Error('Assertion failed: this.state === BackendState.DISCONNECTED');
    }

    this.state = BackendState.DISCONNECTED;
    await this.spawn_process();
    this.state = BackendState.HANDSHAKE;
    await this.handshake();
    this.state = BackendState.CONNECTED;
    this.events.connected.fire();
  }

  // The root of insanity. Please, contain calls to the retarded node.js stream
  // APIs in this method.
  private async spawn_process(): Promise<void> {
    if (!(this.state === BackendState.DISCONNECTED)) {
      throw new Error('Assertion failed: this.state === BackendState.DISCONNECTED');
    }
    if (!(this.proc == null)) {
      throw new Error('Assertion failed: this.proc == null');
    }

    this.proc = (await spawn_subprocess_safe('crosslocale', ['backend'], {
      stdio: [
        'pipe', // stdin
        'pipe', // stdout
        'pipe', // stderr
      ],
      windowsHide: true,
    })) as BackendSubprocess;

    this.proc.on('close', (code) => {
      console.warn('Subprocess exited with code', code);
      this.disconnect();
    });

    this.proc.stdin
      .on('error', (error) => {
        console.error('this.proc.stdin', error);
        this.events.error.fire(error);
        this.disconnect();
      })
      .on('close', () => {
        console.warn('this.proc.stdin closed');
        this.disconnect();
      });

    this.proc.stderr
      .on('error', (error) => {
        console.error('this.proc.stderr', error);
        this.events.error.fire(error);
        this.disconnect();
      })
      .on('data', (chunk: Buffer) => {
        console.warn(chunk.toString('utf8'));
      })
      .on('close', () => {
        console.warn('this.proc.stderr closed');
        this.disconnect();
      });

    // Why are those stupid streams so damn hard to use correctly?
    this.proc.stdout
      .on('error', (error) => {
        console.error('this.proc.stdout', error);
        this.events.error.fire(error);
        this.disconnect();
      })
      .on('close', () => {
        console.warn('this.proc.stdout closed');
        this.disconnect();
      })
      .pipe(stream_binary_split('\n'))
      .on('error', (error) => {
        console.error('this.proc.stdout.pipe(stream_binary_split)', error);
        this.events.error.fire(error);
        this.disconnect();
      })
      .on('data', (line: Buffer) => {
        try {
          this.recv_message_internal(line);
        } catch (error) {
          console.error('recvMessageInternal', error);
          this.events.error.fire(error);
          this.disconnect();
        }
      })
      .on('close', () => {
        console.warn('this.proc.stdout.pipe(stream_binary_split) closed');
        this.disconnect();
      });
  }

  private async send_message_internal(message: Message): Promise<void> {
    if (!(this.state !== BackendState.DISCONNECTED)) {
      throw new Error('Assertion failed: this.state !== BackendState.DISCONNECTED');
    }

    let text = JSON.stringify(message);
    console.log('send', text);
    // TODO: lock the stdin, so that only one write happens at a time
    if (!this.proc.stdin.write(`${text}\n`)) {
      await new Promise<void>((resolve) => {
        this.proc.stdin.once('drain', resolve);
      });
    }
  }

  private recv_message_internal(text_bytes: Buffer): void {
    if (!(this.state !== BackendState.DISCONNECTED)) {
      throw new Error('Assertion failed: this.state !== BackendState.DISCONNECTED');
    }

    let text = text_bytes.toString('utf8');
    console.log('recv', text);
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
        let callback = this.sent_request_error_callbacks.get(message.id);
        if (callback == null) {
          throw new Error('server has sent an error response to an unknown message');
        }
        callback(new Error(message.message));
        break;
      }
    }
  }

  public async send_request(data: RequestMessageType): Promise<ResponseMessageType> {
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
    return response_promise;
  }

  private async handshake(): Promise<void> {
    if (!(this.state === BackendState.HANDSHAKE)) {
      throw new Error('Assertion failed: this.state === BackendState.HANDSHAKE');
    }

    let response = await this.send_request({
      type: 'handshake',
      protocol_version: PROTOCOL_VERSION,
    });
    if (!(response.type === 'handshake')) {
      throw new Error("Assertion failed: response.type === 'handshake'");
    }
    if (!(response.protocol_version === PROTOCOL_VERSION)) {
      throw new Error('Assertion failed: response.protocol_version === PROTOCOL_VERSION');
    }
  }

  public disconnect(): void {
    if (this.state === BackendState.DISCONNECTED) return;

    this.proc.stdin.destroy();
    this.proc.stdout.destroy();
    this.proc.stderr.destroy();

    this.proc.stdin.removeAllListeners();
    this.proc.stdout.removeAllListeners();
    this.proc.stderr.removeAllListeners();
    this.proc.removeAllListeners();

    this.state = BackendState.DISCONNECTED;
    this.proc = null!;

    this.events.disconnected.fire();
  }
}

function spawn_subprocess_safe(
  command: string,
  args: readonly string[],
  options: subprocess.SpawnOptions,
): Promise<subprocess.ChildProcess> {
  return new Promise((resolve, reject) => {
    let proc = subprocess.spawn(command, args, options);

    let caught_error = false;
    let error_listener = (err: Error): void => {
      caught_error = true;
      reject(Object.assign(err, { proc }));
    };
    proc.once('error', error_listener);

    process.nextTick(() => {
      proc.off('error', error_listener);
      if (!caught_error) resolve(proc);
    });
  });
}
