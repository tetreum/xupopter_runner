import client, { Channel, Connection } from "amqplib";
import logger from "./logger";

enum EConnectStatus {
	DISCONNECTED,
	CONNECTING,
	CONNECTED,
	DISCONNECTING,
}

class MessageBroker {
	private readonly _amqUrl: string;
	private _connection: Connection | null = null;
	private _channel: Channel | null = null;
	private status: EConnectStatus = EConnectStatus.DISCONNECTED;
	private queueName = "updateDataImport";

	private messagesToSend: string[] = [];
	private isMessageBeingProcessed = false;

	constructor() {
		const user = process.env.RABBITMQ_USER;
		const password = process.env.RABBITMQ_PASSWORD;
		const serviceName = process.env.RABBITMQ_SERVICE_NAME;
		const port = process.env.RABBITMQ_PORT;
		const virtualHost = process.env.RABBITMQ_VIRTUAL_HOST;

		this._amqUrl = "amqp://" + user + ":" + password + "@" + serviceName + ":" + port + virtualHost;
		logger.info("RabbitMQ connection URL: " + this._amqUrl);
	}

	public async connect(): Promise<void> {
		if (this.isConnected()) {
			throw new Error("Could not connect");
		}

		this.setConnectionStatus(EConnectStatus.CONNECTING);
		this._connection = await client.connect(this._amqUrl);
		this.setConnectionStatus(EConnectStatus.CONNECTED);
		this._channel = await this._connection.createChannel();
	}

	public async disconnect(): Promise<void> {
		if (this.isConnected()) {
			if (this._channel) {
				await this._channel.close();
				this._channel = null;
			}

			this.setConnectionStatus(EConnectStatus.DISCONNECTING);
			await (this._connection as client.Connection).close();
			this.setConnectionStatus(EConnectStatus.DISCONNECTED);
			this._connection = null;
		}
	}

	public channel(): Channel {
		if (!this._channel) {
			throw new Error("Could not get channel");
		}

		return this._channel;
	}

	public hasChannel(): boolean {
		return this._channel !== null;
	}

	public async assertQueue(queue: string, options: any): Promise<void> {
		await this.channel().assertQueue(queue, options);
	}

	public async sendToQueue(queue: string, buffer: Buffer): Promise<boolean> {
		return this.channel().sendToQueue(queue, buffer);
	}

	public isConnected(): boolean {
		return this.status === EConnectStatus.CONNECTED;
	}

	public isDisconnected(): boolean {
		return this.status === EConnectStatus.DISCONNECTED;
	}

	public isConnecting(): boolean {
		return this.status === EConnectStatus.CONNECTING;
	}

	async dispatch(msg: string): Promise<void> {
		if (this.connectionHasNotCreatedYet()) {
			if (this.isConnecting()) {
				this.messagesToSend.push(msg);
				return;
			}

			await this.connect();
		}

		if (this.isMessageBeingProcessed) {
			this.messagesToSend.push(msg);
			return;
		}

		if (this.isConnected() && this.hasChannel()) {
			this.isMessageBeingProcessed = true;
			await this.assertQueue(this.queueName, { durable: true });
			const dispatched = this.sendToQueue(this.queueName, Buffer.from(msg));

			if (!dispatched) {
				await this.disconnect();
				this.isMessageBeingProcessed = false;
				throw new Error("Message not dispatched: " + msg);
			} else {
				console.log("Message dispatched: " + msg);
			}

			const nextMessage = this.messagesToSend.shift();
			if (nextMessage === undefined) {
				await this.disconnect();
				this.isMessageBeingProcessed = false;
				return;
			}

			this.isMessageBeingProcessed = false;
			await this.dispatch(nextMessage);
		}
	}

	private connectionHasNotCreatedYet(): boolean {
		return this.isDisconnected() || this.isConnecting();
	}

	private setConnectionStatus(status: EConnectStatus): void {
		this.status = status;
	}
}

const messageBroker = new MessageBroker();
export default messageBroker;
