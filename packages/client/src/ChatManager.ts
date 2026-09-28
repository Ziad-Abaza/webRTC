import { EventEmitter } from './EventEmitter.js';
import { ChatMessage, NexusEvents, WebRTCEvents } from '@webrtc/core';

export class ChatManager extends EventEmitter {
  private messages: ChatMessage[] = [];

  constructor(private sendSocketMessage: (event: NexusEvents, payload: any) => void) {
    super();
  }

  handleIncomingMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.emit('message', message);
  }

  send(content: string, recipientId?: string): void {
    if (!content.trim()) return;
    this.sendSocketMessage(NexusEvents.CHAT_SEND, {
      content: content.trim(),
      recipientId
    });
  }

  sendMessage(content: string, recipientId?: string): void {
    this.send(content, recipientId);
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }
}
