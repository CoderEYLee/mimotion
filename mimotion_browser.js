/**
 * 小米运动/Zepp Life 自动刷步数 - 纯 JavaScript 实现
 *
 * 功能概述：
 *   1. 通过 AES 加密登录 Zepp API，获取 access_token
 *   2. 通过 access_token 获取 login_token、app_token、user_id
 *   3. 使用 app_token 提交伪造的步数数据到华米接口
 *   4. 支持 Token 缓存（localStorage），避免频繁登录
 *   5. 支持多渠道推送：PushPlus、企业微信 Webhook、飞书 Webhook、Telegram Bot
 *
 * 依赖：现代浏览器（内置 fetch, crypto.getRandomValues, crypto.subtle）
 *
 * 用法：
 *   在浏览器中直接运行，或通过 HTML 页面引用
 *
 * 配置：
 *   在 execute() 函数中修改账号密码和推送配置
 */

// ============================================================================
// Browser 兼容层：Buffer Polyfill (基于 Uint8Array)
// ============================================================================

class Buffer {
  constructor(data, encoding) {
    if (data instanceof Uint8Array) {
      this._data = new Uint8Array(data);
    } else if (data instanceof ArrayBuffer) {
      this._data = new Uint8Array(data);
    } else if (Array.isArray(data)) {
      this._data = new Uint8Array(data);
    } else if (typeof data === 'string') {
      this._data = new TextEncoder().encode(data);
    } else if (typeof data === 'number') {
      this._data = new Uint8Array(data);
    } else if (data && typeof data === 'object' && data._data instanceof Uint8Array) {
      // 兼容另一个 Buffer 实例
      this._data = data._data;
    } else {
      this._data = new Uint8Array(0);
    }
  }

  static from(data, encoding) {
    if (typeof data === 'string') {
      return new Buffer(new TextEncoder().encode(data));
    } else if (data instanceof Uint8Array) {
      return new Buffer(data);
    } else if (data instanceof ArrayBuffer) {
      return new Buffer(new Uint8Array(data));
    } else if (Array.isArray(data)) {
      return new Buffer(new Uint8Array(data));
    }
    return new Buffer(data);
  }

  static alloc(size, fill = 0) {
    const buf = new Uint8Array(size);
    if (fill !== 0) buf.fill(fill);
    return new Buffer(buf);
  }

  static concat(buffers) {
    const totalLen = buffers.reduce((sum, b) => sum + b.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const b of buffers) {
      result.set(b._data || b, offset);
      offset += b.length;
    }
    return new Buffer(result);
  }

  static isBuffer(obj) {
    return obj instanceof Buffer;
  }

  get length() {
    return this._data.length;
  }

  get [Symbol.toStringTag]() {
    return 'Buffer';
  }

  toString(encoding = 'utf-8', start = 0, end = this.length) {
    if (encoding === 'utf-8' || encoding === 'utf8') {
      return new TextDecoder().decode(this._data.slice(start, end));
    }
    return Array.from(this._data.slice(start, end)).map(b => String.fromCharCode(b)).join('');
  }

  slice(start, end) {
    return new Buffer(this._data.slice(start, end));
  }

  subarray(start, end) {
    return new Buffer(this._data.subarray(start, end));
  }

  fill(value, start = 0, end = this.length) {
    if (typeof value === 'number') {
      this._data.fill(value, start, end);
    }
    return this;
  }

  set(source, offset = 0) {
    this._data.set(source._data || source, offset);
    return this;
  }
}

// ============================================================================
// 运动数据模板（硬编码）
// URL 编码的 JSON 数组，包含心率、步数等伪造运动数据
// 提交时需替换其中的日期（date）和步数（ttl）字段
// ============================================================================
const BAND_DATA_TEMPLATE = `%5B%7B%22data_hr%22%3A%22%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9L%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FVv%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0v%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9e%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0n%5C%2Fa%5C%2F%5C%2F%5C%2FS%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0b%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F1FK%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FR%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9PTFFpaf9L%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FR%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0j%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9K%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FOv%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2Fzf%5C%2F%5C%2F%5C%2F86%5C%2Fzr%5C%2FOv88%5C%2Fzf%5C%2FPf%5C%2F%5C%2F%5C%2F0v%5C%2FS%5C%2F8%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FSf%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2Fz3%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0r%5C%2FOv%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FS%5C%2F9L%5C%2Fzb%5C%2FSf9K%5C%2F0v%5C%2FRf9H%5C%2Fzj%5C%2FSf9K%5C%2F0%5C%2F%5C%2FN%5C%2F%5C%2F%5C%2F%5C%2F0D%5C%2FSf83%5C%2Fzr%5C%2FPf9M%5C%2F0v%5C%2FOv9e%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FS%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2Fzv%5C%2F%5C%2Fz7%5C%2FO%5C%2F83%5C%2Fzv%5C%2FN%5C%2F83%5C%2Fzr%5C%2FN%5C%2F86%5C%2Fz%5C%2F%5C%2FNv83%5C%2Fzn%5C%2FXv84%5C%2Fzr%5C%2FPP84%5C%2Fzj%5C%2FN%5C%2F9e%5C%2Fzr%5C%2FN%5C%2F89%5C%2F03%5C%2FP%5C%2F89%5C%2Fz3%5C%2FQ%5C%2F9N%5C%2F0v%5C%2FTv9C%5C%2F0H%5C%2FOf9D%5C%2Fzz%5C%2FOf88%5C%2Fz%5C%2F%5C%2FPP9A%5C%2Fzr%5C%2FN%5C%2F86%5C%2Fzz%5C%2FNv87%5C%2F0D%5C%2FOv84%5C%2F0v%5C%2FO%5C%2F84%5C%2Fzf%5C%2FMP83%5C%2FzH%5C%2FNv83%5C%2Fzf%5C%2FN%5C%2F84%5C%2Fzf%5C%2FOf82%5C%2Fzf%5C%2FOP83%5C%2Fzb%5C%2FMv81%5C%2FzX%5C%2FR%5C%2F9L%5C%2F0v%5C%2FO%5C%2F9I%5C%2F0T%5C%2FS%5C%2F9A%5C%2Fzn%5C%2FPf89%5C%2Fzn%5C%2FNf9K%5C%2F07%5C%2FN%5C%2F83%5C%2Fzn%5C%2FNv83%5C%2Fzv%5C%2FO%5C%2F9A%5C%2F0H%5C%2FOf8%5C%2F%5C%2Fzj%5C%2FPP83%5C%2Fzj%5C%2FS%5C%2F87%5C%2Fzj%5C%2FNv84%5C%2Fzf%5C%2FOf83%5C%2Fzf%5C%2FOf83%5C%2Fzb%5C%2FNv9L%5C%2Fzj%5C%2FNv82%5C%2Fzb%5C%2FN%5C%2F85%5C%2Fzf%5C%2FN%5C%2F9J%5C%2Fzf%5C%2FNv83%5C%2Fzj%5C%2FNv84%5C%2F0r%5C%2FSv83%5C%2Fzf%5C%2FMP%5C%2F%5C%2F%5C%2Fzb%5C%2FMv82%5C%2Fzb%5C%2FOf85%5C%2Fz7%5C%2FNv8%5C%2F%5C%2F0r%5C%2FS%5C%2F85%5C%2F0H%5C%2FQP9B%5C%2F0D%5C%2FNf89%5C%2Fzj%5C%2FOv83%5C%2Fzv%5C%2FNv8%5C%2F%5C%2F0f%5C%2FSv9O%5C%2F0ZeXv%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F1X%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9B%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FTP%5C%2F%5C%2F%5C%2F1b%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9N%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%22%2C%22date%22%3A%222021-08-07%22%2C%22data%22%3A%5B%7B%22start%22%3A0%2C%22stop%22%3A1439%2C%22value%22%3A%22UA8AUBQAUAwAUBoAUAEAYCcAUBkAUB4AUBgAUCAAUAEAUBkAUAwAYAsAYB8AYB0AYBgAYCoAYBgAYB4AUCcAUBsAUB8AUBwAUBIAYBkAYB8AUBoAUBMAUCEAUCIAYBYAUBwAUCAAUBgAUCAAUBcAYBsAYCUAATIPYD0KECQAYDMAYB0AYAsAYCAAYDwAYCIAYB0AYBcAYCQAYB0AYBAAYCMAYAoAYCIAYCEAYCYAYBsAYBUAYAYAYCIAYCMAUB0AUCAAUBYAUCoAUBEAUC8AUB0AUBYAUDMAUDoAUBkAUC0AUBQAUBwAUA0AUBsAUAoAUCEAUBYAUAwAUB4AUAwAUCcAUCYAUCwKYDUAAUUlEC8IYEMAYEgAYDoAYBAAUAMAUBkAWgAAWgAAWgAAWgAAWgAAUAgAWgAAUBAAUAQAUA4AUA8AUAkAUAIAUAYAUAcAUAIAWgAAUAQAUAkAUAEAUBkAUCUAWgAAUAYAUBEAWgAAUBYAWgAAUAYAWgAAWgAAWgAAWgAAUBcAUAcAWgAAUBUAUAoAUAIAWgAAUAQAUAYAUCgAWgAAUAgAWgAAWgAAUAwAWwAAXCMAUBQAWwAAUAIAWgAAWgAAWgAAWgAAWgAAWgAAWgAAWgAAWREAWQIAUAMAWSEAUDoAUDIAUB8AUCEAUC4AXB4AUA4AWgAAUBIAUA8AUBAAUCUAUCIAUAMAUAEAUAsAUAMAUCwAUBYAWgAAWgAAWgAAWgAAWgAAWgAAUAYAWgAAWgAAWgAAUAYAWwAAWgAAUAYAXAQAUAMAUBsAUBcAUCAAWwAAWgAAWgAAWgAAWgAAUBgAUB4AWgAAUAcAUAwAWQIAWQkAUAEAUAIAWgAAUAoAWgAAUAYAUB0AWgAAWgAAUAkAWgAAWSwAUBIAWgAAUC4AWSYAWgAAUAYAUAoAUAkAUAIAUAcAWgAAUAEAUBEAUBgAUBcAWRYAUA0AWSgAUB4AUDQAUBoAXA4AUA8AUBwAUA8AUA4AUA4AWgAAUAIAUCMAWgAAUCwAUBgAUAYAUAAAUAAAUAAAUAAAUAAAUAAAUAAAUAAAUAAAWwAAUAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAeSEAeQ8AcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBcAcAAAcAAAcCYOcBUAUAAAUAAAUAAAUAAAUAUAUAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcCgAeQAAcAAAcAAAcAAAcAAAcAAAcAYAcAAAcBgAeQAAcAAAcAAAegAAegAAcAAAcAcAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcCkAeQAAcAcAcAAAcAAAcAwAcAAAcAAAcAIAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcCIAeQAAcAAAcAAAcAAAcAAAcAAAeRwAeQAAWgAAUAAAUAAAUAAAUAAAUAAAcAAAcAAAcBoAeScAeQAAegAAcBkAeQAAUAAAUAAAUAAAUAAAUAAAUAAAcAAAcAAAcAAAcAAAcAAAcAAAegAAegAAcAAAcAAAcBgAeQAAcAAAcAAAcAAAcAAAcAAAcAkAegAAegAAcAcAcAAAcAcAcAAAcAAAcAAAcAAAcA8AeQAAcAAAcAAAeRQAcAwAUAAAUAAAUAAAUAAAUAAAUAAAcAAAcBEAcA0AcAAAWQsAUAAAUAAAUAAAUAAAUAAAcAAAcAoAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAYAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBYAegAAcAAAcAAAegAAcAcAcAAAcAAAcAAAcAAAcAAAeRkAegAAegAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAEAcAAAcAAAcAAAcAUAcAQAcAAAcBIAeQAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBsAcAAAcAAAcBcAeQAAUAAAUAAAUAAAUAAAUAAAUBQAcBYAUAAAUAAAUAoAWRYAWTQAWQAAUAAAUAAAUAAAcAAAcAAAcAAAcAAAcAAAcAMAcAAAcAQAcAAAcAAAcAAAcDMAeSIAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBQAeQwAcAAAcAAAcAAAcAMAcAAAeSoAcA8AcDMAcAYAeQoAcAwAcFQAcEMAeVIAaTYAbBcNYAsAYBIAYAIAYAIAYBUAYCwAYBMAYDYAYCkAYDcAUCoAUCcAUAUAUBAAWgAAYBoAYBcAYCgAUAMAUAYAUBYAUA4AUBgAUAgAUAgAUAsAUAsAUA4AUAMAUAYAUAQAUBIAASsSUDAAUDAAUBAAYAYAUBAAUAUAUCAAUBoAUCAAUBAAUAoAYAIAUAQAUAgAUCcAUAsAUCIAUCUAUAoAUA4AUB8AUBkAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAA%22%2C%22tz%22%3A32%2C%22did%22%3A%22DA932FFFFE8816E7%22%2C%22src%22%3A24%7D%5D%2C%22summary%22%3A%22%7B%5C%22v%5C%22%3A6%2C%5C%22slp%5C%22%3A%7B%5C%22st%5C%22%3A1628296479%2C%5C%22ed%5C%22%3A1628296479%2C%5C%22dp%5C%22%3A0%2C%5C%22lt%5C%22%3A0%2C%5C%22wk%5C%22%3A0%2C%5C%22usrSt%5C%22%3A-1440%2C%5C%22usrEd%5C%22%3A-1440%2C%5C%22wc%5C%22%3A0%2C%5C%22is%5C%22%3A0%2C%5C%22lb%5C%22%3A0%2C%5C%22to%5C%22%3A0%2C%5C%22dt%5C%22%3A0%2C%5C%22rhr%5C%22%3A0%2C%5C%22ss%5C%22%3A0%7D%2C%5C%22stp%5C%22%3A%7B%5C%22ttl%5C%22%3A18272%2C%5C%22dis%5C%22%3A10627%2C%5C%22cal%5C%22%3A510%2C%5C%22wk%5C%22%3A41%2C%5C%22rn%5C%22%3A50%2C%5C%22runDist%5C%22%3A7654%2C%5C%22runCal%5C%22%3A397%2C%5C%22stage%5C%22%3A%5B%7B%5C%22start%5C%22%3A327%2C%5C%22stop%5C%22%3A341%2C%5C%22mode%5C%22%3A1%2C%5C%22dis%5C%22%3A481%2C%5C%22cal%5C%22%3A13%2C%5C%22step%5C%22%3A680%7D%2C%7B%5C%22start%5C%22%3A342%2C%5C%22stop%5C%22%3A367%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A2295%2C%5C%22cal%5C%22%3A95%2C%5C%22step%5C%22%3A2874%7D%2C%7B%5C%22start%5C%22%3A368%2C%5C%22stop%5C%22%3A377%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A1592%2C%5C%22cal%5C%22%3A88%2C%5C%22step%5C%22%3A1664%7D%2C%7B%5C%22start%5C%22%3A378%2C%5C%22stop%5C%22%3A386%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A1072%2C%5C%22cal%5C%22%3A51%2C%5C%22step%5C%22%3A1245%7D%2C%7B%5C%22start%5C%22%3A387%2C%5C%22stop%5C%22%3A393%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A1036%2C%5C%22cal%5C%22%3A57%2C%5C%22step%5C%22%3A1124%7D%2C%7B%5C%22start%5C%22%3A394%2C%5C%22stop%5C%22%3A398%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A488%2C%5C%22cal%5C%22%3A19%2C%5C%22step%5C%22%3A607%7D%2C%7B%5C%22start%5C%22%3A399%2C%5C%22stop%5C%22%3A414%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A2220%2C%5C%22cal%5C%22%3A120%2C%5C%22step%5C%22%3A2371%7D%2C%7B%5C%22start%5C%22%3A415%2C%5C%22stop%5C%22%3A427%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A1268%2C%5C%22cal%5C%22%3A59%2C%5C%22step%5C%22%3A1489%7D%2C%7B%5C%22start%5C%22%3A428%2C%5C%22stop%5C%22%3A433%2C%5C%22mode%5C%22%3A1%2C%5C%22dis%5C%22%3A152%2C%5C%22cal%5C%22%3A4%2C%5C%22step%5C%22%3A238%7D%2C%7B%5C%22start%5C%22%3A434%2C%5C%22stop%5C%22%3A444%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A2295%2C%5C%22cal%5C%22%3A95%2C%5C%22step%5C%22%3A2874%7D%2C%7B%5C%22start%5C%22%3A445%2C%5C%22stop%5C%22%3A455%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A1592%2C%5C%22cal%5C%22%3A88%2C%5C%22step%5C%22%3A1664%7D%2C%7B%5C%22start%5C%22%3A456%2C%5C%22stop%5C%22%3A466%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A1072%2C%5C%22cal%5C%22%3A51%2C%5C%22step%5C%22%3A1245%7D%2C%7B%5C%22start%5C%22%3A467%2C%5C%22stop%5C%22%3A477%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A1036%2C%5C%22cal%5C%22%3A57%2C%5C%22step%5C%22%3A1124%7D%2C%7B%5C%22start%5C%22%3A478%2C%5C%22stop%5C%22%3A488%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A488%2C%5C%22cal%5C%22%3A19%2C%5C%22step%5C%22%3A607%7D%2C%7B%5C%22start%5C%22%3A489%2C%5C%22stop%5C%22%3A499%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A2220%2C%5C%22cal%5C%22%3A120%2C%5C%22step%5C%22%3A2371%7D%2C%7B%5C%22start%5C%22%3A500%2C%5C%22stop%5C%22%3A511%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A1268%2C%5C%22cal%5C%22%3A59%2C%5C%22step%5C%22%3A1489%7D%2C%7B%5C%22start%5C%22%3A512%2C%5C%22stop%5C%22%3A522%2C%5C%22mode%5C%22%3A1%2C%5C%22dis%5C%22%3A152%2C%5C%22cal%5C%22%3A4%2C%5C%22step%5C%22%3A238%7D%5D%7D%2C%5C%22goal%5C%22%3A8000%2C%5C%22tz%5C%22%3A%5C%2228800%5C%22%7D%22%2C%22source%22%3A24%2C%22type%22%3A0%7D%5D`;

// ============================================================================
// AES 加解密模块（纯 JS 实现，使用 Web Crypto API）
// ============================================================================

/** 华米传输加密使用的固定密钥和 IV（参考自 https://github.com/hanximeng/Zepp_API/blob/main/index.php） */
const HM_AES_KEY = Buffer.from('xeNtBVqzDc6tuNTh', 'utf-8'); // 16 bytes
const HM_AES_IV = Buffer.from('MAAAYAAAAAAAAABg', 'utf-8');   // 16 bytes

const AES_BLOCK_SIZE = 16;

/**
 * PKCS#7 填充
 * @param {Buffer} data - 原始数据
 * @returns {Buffer} 填充后的数据
 */
function pkcs7Pad(data) {
  const padLen = AES_BLOCK_SIZE - (data.length % AES_BLOCK_SIZE);
  console.log(`[AES] PKCS#7 填充: 数据长度=${data.length}, 填充长度=${padLen}`);
  const padded = Buffer.alloc(data.length + padLen, 0);
  padded.set(data);
  for (let i = data.length; i < padded.length; i++) {
    padded._data[i] = padLen;
  }
  return padded;
}

/**
 * PKCS#7 去填充
 * @param {Buffer} data - 填充后的数据
 * @returns {Buffer} 去填充后的原始数据
 */
function pkcs7Unpad(data) {
  if (!data || data.length % AES_BLOCK_SIZE !== 0) {
    throw new Error(`无效的填充数据长度: ${data.length}`);
  }
  const padLen = data._data[data.length - 1];
  if (padLen < 1 || padLen > AES_BLOCK_SIZE) {
    throw new Error(`无效的填充长度: ${padLen}`);
  }
  for (let i = data.length - padLen; i < data.length; i++) {
    if (data._data[i] !== padLen) {
      throw new Error('无效的 PKCS#7 填充');
    }
  }
  console.log(`[AES] PKCS#7 去填充: 数据长度=${data.length}, 去填充长度=${padLen}, 结果长度=${data.length - padLen}`);
  return data.slice(0, data.length - padLen);
}

/**
 * 生成随机字节（浏览器环境）
 * @param {number} size - 字节数
 * @returns {Buffer} 随机字节数组
 */
function randomBytes(size) {
  const arr = new Uint8Array(size);
  crypto.getRandomValues(arr);
  return new Buffer(arr);
}

/**
 * AES-128-CBC 加密（使用 Web Crypto API）
 * @param {Buffer} plain - 明文
 * @param {Buffer} key - 16 字节密钥
 * @param {Buffer|null} iv - IV 向量，为 null 时生成随机 IV
 * @returns {Promise<Buffer>} iv+ciphertext（随机IV时）或仅 ciphertext（固定IV时）
 */
async function encryptData(plain, key, iv = null) {
  if (!Buffer.isBuffer(key) || key.length !== 16) {
    throw new Error('密钥必须为 16 字节');
  }
  if (!Buffer.isBuffer(plain)) {
    throw new Error('明文必须为 Buffer');
  }
  console.log(`[AES] 加密: 明文长度=${plain.length}, IV模式=${iv === null ? '随机' : '固定'}`);
  const padded = pkcs7Pad(plain);

  // 导入密钥
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key._data,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );

  if (iv === null) {
    // 随机 IV，返回 IV + 密文
    const randomIv = new Uint8Array(AES_BLOCK_SIZE);
    crypto.getRandomValues(randomIv);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: randomIv },
      cryptoKey,
      padded._data
    );

    const result = Buffer.concat([new Buffer(randomIv), new Buffer(ciphertext)]);
    console.log(`[AES] 加密完成: 密文长度=${result.length} (IV=16 + 密文=${ciphertext.byteLength})`);
    return result;
  } else {
    // 固定 IV，仅返回密文
    if (!Buffer.isBuffer(iv) || iv.length !== AES_BLOCK_SIZE) {
      throw new Error(`IV 必须为 ${AES_BLOCK_SIZE} 字节`);
    }

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: iv._data },
      cryptoKey,
      padded._data
    );

    const result = new Buffer(ciphertext);
    console.log(`[AES] 加密完成: 密文长度=${result.length}`);
    return result;
  }
}

/**
 * AES-128-CBC 解密（使用 Web Crypto API）
 * @param {Buffer} data - 密文数据（随机IV时含前16字节IV，固定IV时仅密文）
 * @param {Buffer} key - 16 字节密钥
 * @param {Buffer|null} iv - IV 向量，为 null 时从数据前16字节提取
 * @returns {Promise<Buffer>} 明文
 */
async function decryptData(data, key, iv = null) {
  if (!Buffer.isBuffer(key) || key.length !== 16) {
    throw new Error('密钥必须为 16 字节');
  }
  if (!Buffer.isBuffer(data)) {
    throw new Error('数据必须为 Buffer');
  }
  console.log(`[AES] 解密: 数据长度=${data.length}, IV模式=${iv === null ? '从数据提取' : '固定'}`);

  // 导入密钥
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key._data,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );

  let actualIv, ciphertext;
  if (iv === null) {
    if (data.length < AES_BLOCK_SIZE) throw new Error('数据过短');
    actualIv = data._data.subarray(0, AES_BLOCK_SIZE);
    ciphertext = data._data.subarray(AES_BLOCK_SIZE);
  } else {
    if (!Buffer.isBuffer(iv) || iv.length !== AES_BLOCK_SIZE) {
      throw new Error(`IV 必须为 ${AES_BLOCK_SIZE} 字节`);
    }
    actualIv = iv._data;
    ciphertext = data._data;
  }

  if (ciphertext.length === 0 || ciphertext.length % AES_BLOCK_SIZE !== 0) {
    throw new Error('无效的密文长度');
  }

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: actualIv },
    cryptoKey,
    ciphertext
  );

  const result = pkcs7Unpad(new Buffer(decrypted));
  console.log(`[AES] 解密完成: 明文长度=${result.length}`);
  return result;
}

// ============================================================================
// 工具函数
// ============================================================================

/** 获取北京时间 */
function getBeijingTime() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
}

/** 格式化当前北京时间，如 "2024-01-01 12:00:00" */
function formatNow() {
  const bj = getBeijingTime();
  const pad = (n) => String(n).padStart(2, '0');
  return `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())} ${pad(bj.getHours())}:${pad(bj.getMinutes())}:${pad(bj.getSeconds())}`;
}

/** 获取当前时间戳（毫秒） */
function getTime() { return String(Date.now()); }

/** 获取配置中的整数值，不存在则使用默认值 */
function getIntValueDefault(config, key, defaultValue) {
  if (config[key] === undefined || config[key] === '') config[key] = defaultValue;
  return parseInt(config[key], 10);
}

/**
 * 根据当前时间计算步数范围
 * 步数随时间线性增长，北京时间22点达到最大值
 * @returns {[number, number]} [最小步数, 最大步数]
 */
function getMinMaxByTime(hour, minute, config) {
  const timeRate = Math.min((hour * 60 + minute) / (22 * 60), 1);
  const minStep = getIntValueDefault(config, 'MIN_STEP', 18000);
  const maxStep = getIntValueDefault(config, 'MAX_STEP', 25000);
  return [Math.floor(timeRate * minStep), Math.floor(timeRate * maxStep)];
}

/** 账号脱敏处理 */
function desensitizeUserName(user) {
  if (user.length <= 8) {
    const ln = Math.max(Math.floor(user.length / 3), 1);
    return `${user.slice(0, ln)}***${user.slice(-ln)}`;
  }
  return `${user.slice(0, 3)}****${user.slice(-4)}`;
}

/** 随机整数 [min, max] */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** UUID v4 */
function uuid() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** 从 Location 头提取 access_token */
function getAccessToken(location) {
  const m = location.match(/access=(.*?)(&|$)/);
  return m ? m[1] : null;
}

/** 从 Location 头提取 error */
function getErrorCode(location) {
  const m = location.match(/error=(.*?)(&|$)/);
  return m ? m[1] : null;
}

// ============================================================================
// Zepp API 交互模块
// ============================================================================

/**
 * 第一步：通过账号密码登录获取 access_token
 * 登录请求的参数使用华米固定 AES 密钥加密
 *
 * @param {string} user - 登录账号（手机号需带 +86 前缀，或邮箱）
 * @param {string} password - 登录密码
 * @returns {Promise<[string|null, string|null]>} [access_token, 错误信息]
 */
async function loginAccessToken(user, password) {
  console.log(`[Zepp] 开始登录获取 access_token, 账号: ${desensitizeUserName(user)}`);
  const headers = {
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'user-agent': 'MiFit6.14.0 (M2007J1SC; Android 12; Density/2.75)',
    'app_name': 'com.xiaomi.hm.health',
    'appname': 'com.xiaomi.hm.health',
    'appplatform': 'android_phone',
    'x-hm-ekv': '1',
    'hm-privacy-ceip': 'false',
  };

  const loginData = {
    emailOrPhone: user,
    password,
    state: 'REDIRECTION',
    client_id: 'HuaMi',
    country_code: 'CN',
    token: 'access',
    redirect_uri: 'https://s3-us-west-2.amazonaws.com/hm-registration/successsignin.html',
  };

  // 将参数编码为 query string，然后用华米固定密钥 AES 加密
  const queryString = new URLSearchParams(loginData).toString();
  const plaintext = Buffer.from(queryString, 'utf-8');
  const cipherData = await encryptData(plaintext, HM_AES_KEY, HM_AES_IV);
  console.log(`[Zepp] 登录请求加密完成, 密文长度: ${cipherData.length}`);

  const url = 'https://api-user.zepp.com/v2/registrations/tokens';
  try {
    console.log(`[Zepp] 发送登录请求: POST ${url}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: cipherData,
      redirect: 'manual', // 不自动跟随重定向，需要从 303 的 Location 头提取 token
    });
    console.log(`[Zepp] 登录响应状态: ${resp.status}`);
    if (resp.status !== 303) {
      return [null, `登录异常，status: ${resp.status}`];
    }
    const location = resp.headers.get('Location') || '';
    console.log(`[Zepp] 登录重定向 Location: ${location.substring(0, 100)}...`);
    const code = getAccessToken(location);
    if (!code) {
      const errorCode = getErrorCode(location);
      console.log(`[Zepp] 获取 accessToken 失败, error: ${errorCode}`);
      return [null, `获取accessToken失败: ${errorCode}`];
    }
    console.log(`[Zepp] 获取 accessToken 成功, 长度: ${code.length}`);
    console.log(`[Zepp] 【网络响应数据】accessToken=${code.substring(0, 20)}...${code.substring(code.length - 10)}`);
    return [code, null];
  } catch (e) {
    console.log(`[Zepp] 登录请求异常: ${e.message}`);
    return [null, `获取accessToken异常: ${e.message}`];
  }
}

/**
 * 第二步：通过 access_token 获取 login_token、app_token、user_id
 * 根据账号类型（手机/邮箱）使用不同的请求参数
 *
 * @param {string} accessToken - 第一步获取的 access_token
 * @param {string} deviceId - 设备 ID（UUID 格式）
 * @param {boolean} isPhone - 是否为手机号登录
 * @returns {Promise<[string|null, string|null, string|null, string|null]>} [login_token, app_token, user_id, 错误信息]
 */
async function grantLoginTokens(accessToken, deviceId, isPhone = false) {
  console.log(`[Zepp] 获取 login_token/app_token, isPhone=${isPhone}, deviceId=${deviceId}`);
  const url = 'https://account.huami.com/v2/client/login';
  const headers = {
    'app_name': 'com.xiaomi.hm.health',
    'x-request-id': uuid(),
    'accept-language': 'zh-CN',
    'appname': 'com.xiaomi.hm.health',
    'cv': '50818_6.14.0',
    'v': '2.0',
    'appplatform': 'android_phone',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  };

  // 手机号和邮箱登录使用不同的参数
  const data = isPhone
    ? {
        app_name: 'com.xiaomi.hm.health',
        app_version: '6.14.0',
        code: accessToken,
        country_code: 'CN',
        device_id: deviceId,
        device_model: 'phone',
        grant_type: 'access_token',
        third_name: 'huami_phone',
      }
    : {
        'allow_registration=': 'false',
        app_name: 'com.xiaomi.hm.health',
        app_version: '6.14.0',
        code: accessToken,
        country_code: 'CN',
        device_id: deviceId,
        device_model: 'android_phone',
        dn: 'account.zepp.com,api-user.zepp.com,api-mifit.zepp.com,api-watch.zepp.com,app-analytics.zepp.com,api-analytics.huami.com,auth.zepp.com',
        grant_type: 'access_token',
        lang: 'zh_CN',
        os_version: '1.5.0',
        source: 'com.xiaomi.hm.health:6.14.0:50818',
        third_name: 'email',
      };

  try {
    console.log(`[Zepp] 发送客户端登录请求: POST ${url}, 登录方式: ${isPhone ? '手机号' : '邮箱'}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: new URLSearchParams(data).toString(),
    });
    const respJson = await resp.json();
    console.log(`[Zepp] 客户端登录响应: result=${respJson.result}`);
    if (respJson.result !== 'ok') {
      return [null, null, null, `客户端登录失败: ${respJson.result}`];
    }
    const { login_token, app_token, user_id } = respJson.token_info;
    console.log(`[Zepp] 获取 token 成功: user_id=${user_id}, login_token长度=${login_token?.length}, app_token长度=${app_token?.length}`);
    console.log(`[Zepp] 【网络响应数据】user_id=${user_id}, login_token=${login_token?.substring(0, 20)}..., app_token=${app_token?.substring(0, 20)}...`);
    return [login_token, app_token, user_id, null];
  } catch (e) {
    console.log(`[Zepp] 提取login_token失败: ${e.message}`);
    return [null, null, null, null];
  }
}

/**
 * 通过 login_token 刷新获取新的 app_token
 * 当 app_token 过期但 login_token 仍有效时使用
 *
 * @param {string} loginToken - 登录 token
 * @returns {Promise<[string|null, string|null]>} [app_token, 错误信息]
 */
async function grantAppToken(loginToken) {
  console.log(`[Zepp] 尝试通过 login_token 刷新 app_token, login_token长度=${loginToken?.length}`);
  const url = `https://account-cn.huami.com/v1/client/app_tokens?app_name=com.xiaomi.hm.health&dn=api-user.huami.com%2Capi-mifit.huami.com%2Capp-analytics.huami.com&login_token=${loginToken}`;
  const headers = { 'User-Agent': 'MiFit/5.3.0 (iPhone; iOS 14.7.1; Scale/3.00)' };

  try {
    console.log(`[Zepp] 发送刷新 app_token 请求: GET ${url.substring(0, 80)}...`);
    const resp = await fetch(url, { headers });
    console.log(`[Zepp] 刷新 app_token 响应状态: ${resp.status}`);
    if (resp.status !== 200) return [null, `请求异常: ${resp.status}`];
    const respJson = await resp.json();
    console.log(`[Zepp] grantAppToken: ${JSON.stringify(respJson)}`);
    if (respJson.result !== 'ok') return [null, `请求失败: ${respJson.error_code}`];
    console.log(`[Zepp] 刷新 app_token 成功, 长度=${respJson.token_info.app_token?.length}`);
    console.log(`[Zepp] 【网络响应数据】app_token=${respJson.token_info.app_token?.substring(0, 20)}...`);
    return [respJson.token_info.app_token, null];
  } catch (e) {
    console.log(`[Zepp] 刷新 app_token 异常: ${e.message}`);
    return [null, `请求异常: ${e.message}`];
  }
}

/**
 * 检查 app_token 是否仍然有效（通过请求用户信息接口验证）
 * @param {string} appToken - 应用 token
 * @returns {Promise<[boolean, string|null]>} [是否有效, 错误信息]
 */
async function checkAppToken(appToken) {
  console.log(`[Zepp] 检查 app_token 是否有效, app_token长度=${appToken?.length}`);
  const url = 'https://api-mifit-cn3.zepp.com/huami.health.getUserInfo.json';
  const params = new URLSearchParams({
    r: '00b7912b-790a-4552-81b1-3742f9dd1e76',
    userid: '1188760659',
    appid: '428135909242707968',
    channel: 'Normal', country: 'CN', cv: '50818_6.14.0',
    device: 'android_31', device_type: 'android_phone',
    lang: 'zh_CN', timezone: 'Asia/Shanghai', v: '2.0',
  });
  const headers = {
    'User-Agent': 'MiFit6.14.0 (M2007J1SC; Android 12; Density/2.75)',
    'Accept-Encoding': 'gzip',
    'hm-privacy-diagnostics': 'false', 'country': 'CN',
    'appplatform': 'android_phone', 'hm-privacy-ceip': 'true',
    'x-request-id': uuid(), 'timezone': 'Asia/Shanghai',
    'channel': 'Normal', 'cv': '50818_6.14.0',
    'appname': 'com.xiaomi.hm.health', 'v': '2.0',
    'apptoken': appToken, 'lang': 'zh_CN',
    'clientid': '428135909242707968',
  };
  try {
    console.log(`[Zepp] 发送检查 app_token 请求: GET ${url}`);
    const resp = await fetch(`${url}?${params.toString()}`, { headers });
    console.log(`[Zepp] 检查 app_token 响应状态: ${resp.status}`);
    if (resp.status !== 200) return [false, `请求异常: ${resp.status}`];
    const respJson = await resp.json();
    const isValid = respJson.message === 'success';
    console.log(`[Zepp] app_token 检查结果: ${isValid ? '有效' : '无效'}, message=${respJson.message}`);
    console.log(`[Zepp] 【网络响应数据】checkAppToken 响应: ${JSON.stringify(respJson).substring(0, 200)}`);
    return isValid ? [true, null] : [false, respJson.message];
  } catch (e) {
    console.log(`[Zepp] 检查 app_token 异常: ${e.message}`);
    return [false, `请求异常: ${e.message}`];
  }
}

/**
 * 刷新 login_token
 * @param {string} loginToken - 登录 token
 * @returns {Promise<[string|null, string|null]>} [新的login_token, 错误信息]
 */
async function renewLoginToken(loginToken) {
  console.log(`[Zepp] 刷新 login_token, login_token长度=${loginToken?.length}`);
  const url = 'https://account-cn3.zepp.com/v1/client/renew_login_token';
  const params = new URLSearchParams({
    os_version: 'v0.8.1',
    dn: 'account.zepp.com,api-user.zepp.com,api-mifit.zepp.com,api-watch.zepp.com,app-analytics.zepp.com,api-analytics.huami.com,auth.zepp.com',
    login_token: loginToken,
    source: 'com.xiaomi.hm.health:6.14.0:50818',
    timestamp: getTime(),
  });
  const headers = {
    'User-Agent': 'MiFit6.14.0 (M2007J1SC; Android 12; Density/2.75)',
    'Accept-Encoding': 'gzip', 'app_name': 'com.xiaomi.hm.health',
    'hm-privacy-ceip': 'false', 'x-request-id': uuid(),
    'accept-language': 'zh-CN', 'appname': 'com.xiaomi.hm.health',
    'cv': '50818_6.14.0', 'v': '2.0', 'appplatform': 'android_phone',
  };
  try {
    console.log(`[Zepp] 发送刷新 login_token 请求: GET ${url}`);
    const resp = await fetch(`${url}?${params.toString()}`, { headers });
    console.log(`[Zepp] 刷新 login_token 响应状态: ${resp.status}`);
    if (resp.status !== 200) return [null, `请求异常: ${resp.status}`];
    const respJson = await resp.json();
    console.log(`[Zepp] 刷新 login_token 响应: result=${respJson.result}`);
    if (respJson.result !== 'ok') return [null, `请求失败: ${respJson.result}`];
    console.log(`[Zepp] 刷新 login_token 成功, 新token长度=${respJson.token_info.login_token?.length}`);
    console.log(`[Zepp] 【网络响应数据】login_token=${respJson.token_info.login_token?.substring(0, 20)}...`);
    return [respJson.token_info.login_token, null];
  } catch (e) {
    console.log(`[Zepp] 刷新 login_token 异常: ${e.message}`);
    return [null, `请求异常: ${e.message}`];
  }
}

/**
 * 第三步：提交伪造的步数数据到华米接口
 * 使用模板数据替换日期和步数后提交
 *
 * @param {string} step - 要设置的步数
 * @param {string} appToken - 应用 token
 * @param {string} userid - 用户 ID
 * @returns {Promise<[boolean, string]>} [是否成功, 消息]
 */
async function postFakeBrandData(step, appToken, userid) {
  console.log(`[Zepp] 提交步数数据: step=${step}, userid=${userid}, app_token长度=${appToken?.length}`);
  const t = getTime();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  console.log(`[Zepp] 当前日期: ${today}, 时间戳: ${t}`);

  let dataJson = BAND_DATA_TEMPLATE;
  console.log(`[Zepp] 使用硬编码模板数据, 长度=${dataJson.length}`);

  // 使用正则替换模板中的日期（匹配 date%22%3A%22...%22%2C%22data 模式）
  const dateMatch = dataJson.match(/.*?date%22%3A%22(.*?)%22%2C%22data.*?/);
  if (dateMatch) {
    console.log(`[Zepp] 模板中匹配到日期: ${dateMatch[1]}, 替换为: ${today}`);
    dataJson = dataJson.replace(dateMatch[1], today);
  } else {
    console.log(`[Zepp] 模板中未匹配到日期字段`);
  }

  // 使用正则替换模板中的步数（匹配 ttl%5C%22%3A...%2C%5C%22dis 模式）
  const stepMatch = dataJson.match(/.*?ttl%5C%22%3A(.*?)%2C%5C%22dis.*?/);
  if (stepMatch) {
    console.log(`[Zepp] 模板中匹配到步数: ${stepMatch[1]}, 替换为: ${step}`);
    dataJson = dataJson.replace(stepMatch[1], step);
  } else {
    console.log(`[Zepp] 模板中未匹配到步数字段`);
  }

  const url = `https://api-mifit-cn.huami.com/v1/data/band_data.json?&t=${t}&r=${uuid()}`;
  const headers = {
    'apptoken': appToken,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const body = `userid=${userid}&last_sync_data_time=1597306380&device_type=0&last_deviceid=DA932FFFFE8816E7&data_json=${dataJson}`;

  try {
    console.log(`[Zepp] 发送提交步数请求: POST ${url.substring(0, 80)}...`);
    const resp = await fetch(url, { method: 'POST', headers, body });
    console.log(`[Zepp] 提交步数响应状态: ${resp.status}`);
    if (resp.status !== 200) return [false, `请求修改步数异常: ${resp.status}`];
    const respJson = await resp.json();
    const success = respJson.message === 'success';
    console.log(`[Zepp] 提交步数结果: ${success ? '成功' : '失败'}, message=${respJson.message}`);
    console.log(`[Zepp] 【网络响应数据】postFakeBrandData 响应: ${JSON.stringify(respJson)}`);
    return success ? [true, respJson.message] : [false, respJson.message];
  } catch (e) {
    console.log(`[Zepp] 提交步数异常: ${e.message}`);
    return [false, `请求异常: ${e.message}`];
  }
}

// ============================================================================
// 推送模块
// ============================================================================

/** 推送配置类 */
class PushConfig {
  constructor(options = {}) {
    this.pushPlusToken = options.pushPlusToken;
    this.pushPlusHour = options.pushPlusHour;
    this.pushPlusMax = parseInt(options.pushPlusMax) || 30;
    this.pushWechatWebhookKey = options.pushWechatWebhookKey;
    this.pushFeishuWebhookKey = options.pushFeishuWebhookKey;
    this.telegramBotToken = options.telegramBotToken;
    this.telegramChatId = options.telegramChatId;
  }
}

/**
 * PushPlus 推送（HTML 格式，推送到微信）
 * @param {string} token - PushPlus 的 token
 * @param {string} title - 推送标题
 * @param {string} content - HTML 格式内容
 */
async function pushPlus(token, title, content) {
  console.log(`[Push] PushPlus 推送开始: title=${title}`);
  const url = 'http://www.pushplus.plus/send';
  const data = new URLSearchParams({
    token, title, content,
    template: 'html',
    channel: 'wechat',
  });
  try {
    console.log(`[Push] PushPlus 发送请求: POST ${url}`);
    const resp = await fetch(url, { method: 'POST', body: data.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    console.log(`[Push] PushPlus 响应状态: ${resp.status}`);
    if (resp.status === 200) {
      const json = await resp.json();
      console.log(`[Push] PushPlus 推送完毕：${json.code}-${json.msg}`);
    } else {
      console.log(`[Push] PushPlus 推送失败, status=${resp.status}`);
    }
  } catch (e) {
    console.log(`[Push] PushPlus 推送异常: ${e.message}`);
  }
}

/**
 * 企业微信 Webhook 推送（Markdown 格式）
 * @param {string} key - Webhook 机器人的 key
 * @param {string} title - 推送标题
 * @param {string} content - 推送内容
 */
async function pushWechatWebhook(key, title, content) {
  console.log(`[Push] 企业微信推送开始: title=${title}`);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`;
  const payload = {
    msgtype: 'markdown_v2',
    markdown_v2: { content: `# ${title}\n${content}` },
  };
  try {
    console.log(`[Push] 企业微信发送请求: POST ${url.substring(0, 60)}...`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`[Push] 企业微信响应状态: ${resp.status}`);
    if (resp.status === 200) {
      const json = await resp.json();
      console.log(json.errcode === 0 ? `[Push] 企业微信推送完毕：${json.errmsg}` : `[Push] 企业微信推送失败：${json.errmsg}`);
    } else {
      console.log(`[Push] 企业微信推送失败, status=${resp.status}`);
    }
  } catch (e) {
    console.log(`[Push] 企业微信推送异常: ${e.message}`);
  }
}

/**
 * 飞书 Webhook 推送（文本格式）
 * @param {string} key - Webhook 机器人的 key
 * @param {string} title - 推送标题
 * @param {string} content - 推送内容
 */
async function pushFeishuWebhook(key, title, content) {
  console.log(`[Push] 飞书推送开始: title=${title}`);
  const url = `https://open.feishu.cn/open-apis/bot/v2/hook/${key}`;
  const payload = {
    msg_type: 'text',
    content: { text: `# ${title}\n${content}` },
  };
  try {
    console.log(`[Push] 飞书发送请求: POST ${url.substring(0, 50)}...`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`[Push] 飞书响应状态: ${resp.status}`);
    if (resp.status === 200) {
      const json = await resp.json();
      console.log(json.StatusCode === 0 ? `[Push] 飞书推送完毕：${json.errmsg}` : `[Push] 飞书推送失败：${json.errmsg}`);
    } else {
      console.log(`[Push] 飞书推送失败, status=${resp.status}`);
    }
  } catch (e) {
    console.log(`[Push] 飞书推送异常: ${e.message}`);
  }
}

/**
 * Telegram Bot 推送（HTML 格式）
 * @param {string} botToken - Telegram Bot Token
 * @param {string} chatId - Telegram Chat ID
 * @param {string} content - HTML 格式内容
 */
async function pushTelegramBot(botToken, chatId, content) {
  console.log(`[Push] Telegram 推送开始: chatId=${chatId}`);
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: parseInt(chatId),
    text: content,
    parse_mode: 'HTML',
  };
  try {
    console.log(`[Push] Telegram 发送请求: POST ${url.substring(0, 50)}...`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`[Push] Telegram 响应状态: ${resp.status}`);
    if (resp.status === 200) {
      const json = await resp.json();
      console.log(json.ok ? `[Push] Telegram bot推送完毕：${json.result.message_id}` : `[Push] Telegram bot推送失败: ${JSON.stringify(json)}`);
    } else {
      console.log(`[Push] Telegram bot推送失败: ${resp.status}`);
    }
  } catch (e) {
    console.log(`[Push] Telegram bot推送异常: ${e.message}`);
  }
}

/**
 * 推送所有执行结果到各个渠道
 * @param {Array} execResults - 执行结果数组
 * @param {string} summary - 汇总信息
 * @param {PushConfig} config - 推送配置
 */
async function pushResults(execResults, summary, config) {
  console.log(`[Push] 开始推送结果, 结果数量=${execResults.length}, 汇总=${summary.trim()}`);

  // PushPlus 推送
  if (config.pushPlusToken && config.pushPlusToken !== '' && config.pushPlusToken !== 'NO') {
    let html = `<div>${summary}</div>`;
    if (execResults.length >= config.pushPlusMax) {
      html += '<div>账号数量过多，详细情况请前往github actions中查看</div>';
    } else {
      html += '<ul>';
      for (const r of execResults) {
        html += r.success
          ? `<li><span>账号：${r.user}</span>刷步数成功，接口返回：${r.msg}</li>`
          : `<li><span>账号：${r.user}</span>刷步数失败，失败原因：${r.msg}</li>`;
      }
      html += '</ul>';
    }
    await pushPlus(config.pushPlusToken, `${formatNow()} 刷步数通知`, html);
  } else {
    console.log('未配置 PUSH_PLUS_TOKEN 跳过PUSHPLUS推送');
  }

  // 企业微信推送
  if (config.pushWechatWebhookKey && config.pushWechatWebhookKey !== '' && config.pushWechatWebhookKey !== 'NO') {
    let content = `## ${summary}`;
    if (execResults.length >= config.pushPlusMax) {
      content += '\n- 账号数量过多，详细情况请前往github actions中查看';
    } else {
      for (const r of execResults) {
        content += r.success
          ? `\n- 账号：${r.user}刷步数成功，接口返回：${r.msg}`
          : `\n- 账号：${r.user}刷步数失败，失败原因：${r.msg}`;
      }
    }
    await pushWechatWebhook(config.pushWechatWebhookKey, `${formatNow()} 刷步数通知`, content);
  } else {
    console.log('未配置 WECHAT_WEBHOOK_KEY 跳过微信推送');
  }

  // Telegram 推送
  if (config.telegramBotToken && config.telegramBotToken !== '' && config.telegramBotToken !== 'NO' &&
      config.telegramChatId && config.telegramChatId !== '') {
    let html = `<b>${summary}</b>`;
    if (execResults.length >= config.pushPlusMax) {
      html += '<blockquote>账号数量过多，详细情况请前往github actions中查看</blockquote>';
    } else {
      for (const r of execResults) {
        html += r.success
          ? `<pre><blockquote>账号：${r.user}</blockquote>刷步数成功，接口返回：<b>${r.msg}</b></pre>`
          : `<pre><blockquote>账号：${r.user}</blockquote>刷步数失败，失败原因：<b>${r.msg}</b></pre>`;
      }
    }
    await pushTelegramBot(config.telegramBotToken, config.telegramChatId, html);
  } else {
    console.log('未配置 TELEGRAM_BOT_TOKEN 或 TELEGRAM_CHAT_ID 跳过telegram推送');
  }

  // 飞书推送
  if (config.pushFeishuWebhookKey && config.pushFeishuWebhookKey !== '' && config.pushFeishuWebhookKey !== 'NO') {
    let content = `## ${summary}`;
    if (execResults.length >= config.pushPlusMax) {
      content += '\n- 账号数量过多，详细情况请前往github actions中查看';
    } else {
      for (const r of execResults) {
        content += r.success
          ? `\n- 账号：${r.user}刷步数成功，接口返回：${r.msg}`
          : `\n- 账号：${r.user}刷步数失败，失败原因：${r.msg}`;
      }
    }
    await pushFeishuWebhook(config.pushFeishuWebhookKey, `${formatNow()} 刷步数通知`, content);
  } else {
    console.log('未配置 FEISHU_WEBHOOK_KEY 跳过飞书推送');
  }
}

// ============================================================================
// Token 持久化模块（AES 加密存储到本地文件）
// ============================================================================

// ============================================================================
// Token 缓存存储（浏览器环境使用 localStorage）
// ============================================================================

const TOKEN_STORAGE_KEY = 'mimotion_tokens';

/**
 * 从 localStorage 加载已保存的 token 数据（明文 JSON 格式）
 *
 * @returns {object} token 数据字典
 */
function prepareUserTokens() {
  console.log(`[Token] 【本地存储-读取】加载缓存的 token 数据, key=${TOKEN_STORAGE_KEY}`);
  try {
    const data = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (data) {
      const tokens = JSON.parse(data);
      const userCount = Object.keys(tokens).length;
      console.log(`[Token] 【本地存储-读取】缓存加载成功, 共 ${userCount} 个账号的 token`);
      return tokens;
    }
  } catch (e) {
    console.log(`[Token] 【本地存储-读取】文件格式错误或损坏: ${e.message}`);
    return {};
  }
  console.log(`[Token] 【本地存储-读取】缓存不存在, 返回空对象`);
  return {};
}

/**
 * 将 token 数据明文保存到 localStorage
 *
 * @param {object} userTokens - token 数据字典
 */
function persistUserTokens(userTokens) {
  const userCount = Object.keys(userTokens).length;
  console.log(`[Token] 【本地存储-写入】持久化 token 数据, key=${TOKEN_STORAGE_KEY}, 账号数=${userCount}`);
  const jsonStr = JSON.stringify(userTokens, null, 2);
  localStorage.setItem(TOKEN_STORAGE_KEY, jsonStr);
  console.log(`[Token] 【本地存储-写入】token 数据已保存`);
}

// ============================================================================
// 核心业务逻辑
// ============================================================================

/**
 * 小米运动刷步数执行器
 * 封装单个账号的登录和提交步数逻辑，支持 token 缓存和自动刷新
 */
class MiMotionRunner {
  /**
   * @param {string} user - 登录账号
   * @param {string} passwd - 登录密码
   * @param {object} userTokens - 全局 token 缓存字典（引用传递）
   */
  constructor(user, passwd, userTokens) {
    this.userTokens = userTokens;
    this.deviceId = uuid();
    this.userId = null;
    this.invalid = false;
    this.logStr = '';

    const userStr = String(user);
    const password = String(passwd);

    if (userStr === '' || password === '') {
      this.error = '用户名或密码填写有误！';
      this.invalid = true;
      console.log(`[Runner] 账号配置有误: 用户名或密码为空`);
    }
    this.password = password;

    // 处理账号格式：手机号加 +86 前缀
    if (userStr.startsWith('+86') || userStr.includes('@')) {
      this.user = userStr;
    } else {
      this.user = '+86' + userStr;
    }
    this.isPhone = this.user.startsWith('+86');
    console.log(`[Runner] 初始化完成: 账号=${desensitizeUserName(this.user)}, isPhone=${this.isPhone}, deviceId=${this.deviceId}`);
  }

  /**
   * 登录获取 app_token
   * 优先使用缓存的 token，逐级尝试：app_token → login_token → access_token
   * @returns {Promise<string|null>} app_token 或 null
   */
  async login() {
    console.log(`[Runner] 开始登录流程: 账号=${desensitizeUserName(this.user)}`);
    const tokenInfo = this.userTokens[this.user];

    if (tokenInfo) {
      console.log(`[Runner] 发现缓存的 token 数据, 尝试逐级使用`);
      // 尝试使用缓存的 app_token
      let accessToken = tokenInfo.access_token;
      let loginToken = tokenInfo.login_token;
      let appToken = tokenInfo.app_token;
      this.deviceId = tokenInfo.device_id || uuid();
      this.userId = tokenInfo.user_id;

      // 第一级：检查 app_token 是否有效
      console.log(`[Runner] 第一级: 检查缓存的 app_token 是否有效`);
      const [ok, msg] = await checkAppToken(appToken);
      if (ok) {
        this.logStr += '使用缓存的app_token\n';
        console.log(`[Runner] 缓存的 app_token 有效, 直接使用`);
        return appToken;
      }

      this.logStr += `app_token失效 重新获取 last grant time: ${tokenInfo.app_token_time}\n`;
      console.log(`[Runner] 缓存的 app_token 已失效`);

      // 第二级：尝试用 login_token 刷新 app_token
      console.log(`[Runner] 第二级: 尝试用 login_token 刷新 app_token`);
      const [newAppToken, msg2] = await grantAppToken(loginToken);
      if (newAppToken) {
        this.logStr += '重新获取app_token成功\n';
        tokenInfo.app_token = newAppToken;
        tokenInfo.app_token_time = getTime();
        console.log(`[Runner] 通过 login_token 刷新 app_token 成功`);
        return newAppToken;
      }

      this.logStr += `login_token 失效 重新获取 last grant time: ${tokenInfo.login_token_time}\n`;
      console.log(`[Runner] login_token 也已失效`);

      // 第三级：用 access_token 重新获取所有 token
      console.log(`[Runner] 第三级: 尝试用 access_token 重新获取所有 token`);
      const [newLoginToken, newAppToken2, userId, msg3] = await grantLoginTokens(accessToken, this.deviceId, this.isPhone);
      if (newLoginToken) {
        tokenInfo.login_token = newLoginToken;
        tokenInfo.app_token = newAppToken2;
        tokenInfo.user_id = userId;
        tokenInfo.login_token_time = getTime();
        tokenInfo.app_token_time = getTime();
        this.userId = userId;
        console.log(`[Runner] 通过 access_token 重新获取 token 成功`);
        return newAppToken2;
      }

      this.logStr += `access_token 已失效：${msg3} last grant time:${tokenInfo.access_token_time}\n`;
      console.log(`[Runner] 缓存的 access_token 也已失效, 需要重新登录`);
    } else {
      console.log(`[Runner] 无缓存 token 数据, 需要完整登录`);
    }

    // 没有缓存或全部失效，从头登录
    console.log(`[Runner] 开始完整登录流程: 账号密码登录`);
    const [accessToken, errMsg] = await loginAccessToken(this.user, this.password);
    if (!accessToken) {
      this.logStr += `登录获取accessToken失败：${errMsg}`;
      console.log(`[Runner] 登录获取 accessToken 失败: ${errMsg}`);
      return null;
    }

    console.log(`[Runner] accessToken 获取成功, 继续获取 login_token/app_token`);
    const [loginToken, appToken, userId, errMsg2] = await grantLoginTokens(accessToken, this.deviceId, this.isPhone);
    if (!loginToken) {
      this.logStr += `登录提取的 access_token 无效：${errMsg2}`;
      console.log(`[Runner] grantLoginTokens 失败: ${errMsg2}`);
      return null;
    }

    // 保存 token 到缓存
    this.userTokens[this.user] = {
      access_token: accessToken,
      login_token: loginToken,
      app_token: appToken,
      user_id: userId,
      access_token_time: getTime(),
      login_token_time: getTime(),
      app_token_time: getTime(),
      device_id: this.deviceId,
    };
    this.userId = userId;
    console.log(`[Runner] 完整登录成功, token 已缓存, userId=${userId}`);
    return appToken;
  }

  /**
   * 登录并提交步数
   * @param {number} minStep - 最小步数
   * @param {number} maxStep - 最大步数
   * @returns {Promise<[string, boolean]>} [执行消息, 是否成功]
   */
  async loginAndPostStep(minStep, maxStep) {
    console.log(`[Runner] 开始执行刷步数: 步数范围=${minStep}~${maxStep}`);
    if (this.invalid) {
      console.log(`[Runner] 账号无效, 跳过执行`);
      return ['账号或密码配置有误', false];
    }

    const appToken = await this.login();
    if (!appToken) {
      console.log(`[Runner] 登录失败, 无法提交步数`);
      return ['登陆失败！', false];
    }

    const step = String(randomInt(minStep, maxStep));
    this.logStr += `已设置为随机步数范围(${minStep}~${maxStep}) 随机值:${step}\n`;
    console.log(`[Runner] 随机步数: ${step}`);

    const [ok, msg] = await postFakeBrandData(step, appToken, this.userId);
    console.log(`[Runner] 提交步数结果: ${ok ? '成功' : '失败'}, msg=${msg}`);
    return [`修改步数（${step}）[${msg}]`, ok];
  }
}

/**
 * 主执行函数：登录并提交步数，推送结果
 */
async function execute() {
  console.log('[Main] ========== 开始执行刷步数任务 ==========');

  // 【本地存储-读取】从 localStorage 加载已缓存的 token（明文 JSON 格式）
  const userTokens = prepareUserTokens();
  console.log('[Main] Token 缓存已加载');

  // ========== 解析配置 ==========
  // 创建推送配置
  const pushConfig = new PushConfig({
    pushPlusToken: "",
    pushPlusHour: "",
    pushPlusMax: 30,
    pushWechatWebhookKey: "",
    pushFeishuWebhookKey: "",
    telegramBotToken: "",
    telegramChatId: "",
  });
  console.log(`[Main] 推送配置: PushPlus=${!!pushConfig.pushPlusToken}, 企业微信=${!!pushConfig.pushWechatWebhookKey}, 飞书=${!!pushConfig.pushFeishuWebhookKey}, Telegram=${!!pushConfig.telegramBotToken}`);

  // 账号密码
  const user = "";
  const password = "";
  if (!user || !password) {
    console.log('未正确配置账号密码，无法执行');
    return;
  }

  // 计算步数范围
  const timeBj = getBeijingTime();
  const stepConfig = { MIN_STEP: 18000, MAX_STEP: 25000 };
  const [minStep, maxStep] = getMinMaxByTime(timeBj.getHours(), timeBj.getMinutes(), stepConfig);
  console.log(`[Main] 北京时间: ${formatNow()}, 步数范围: ${minStep}~${maxStep}`);

  // ========== 执行刷步数 ==========
  let logStr = `[${formatNow()}]\n账号：${desensitizeUserName(user)}\n`;
  let execResult;

  try {
    const runner = new MiMotionRunner(user, password, userTokens);
    const [execMsg, success] = await runner.loginAndPostStep(minStep, maxStep);
    logStr += runner.logStr;
    logStr += `${execMsg}\n`;
    console.log(logStr);
    console.log(`[Main] 账号 ${desensitizeUserName(user)} 执行完毕: ${success ? '成功' : '失败'}`);
    execResult = { user, success, msg: execMsg };
  } catch (e) {
    logStr += `执行异常:${e.message}\n${e.stack}\n`;
    console.log(logStr);
    console.log(`[Main] 账号 ${desensitizeUserName(user)} 执行异常: ${e.message}`);
    execResult = { user, success: false, msg: `执行异常:${e.message}` };
  }

  const summary = `\n执行结果：${execResult.success ? '成功' : '失败'}, ${execResult.msg}`;
  console.log(`[Main] ========== 执行完毕 ==========${summary}`);

  // 【本地存储-写入】将本次执行获取/更新的 token 保存到 localStorage
  console.log(`[Main] 【本地存储-写入】持久化 token 缓存`);
  persistUserTokens(userTokens);

  // 推送结果
  console.log(`[Main] 开始推送结果`);
  await pushResults([execResult], summary, pushConfig);
  console.log(`[Main] 推送完毕`);
}

// ============================================================================
// 入口
// ============================================================================
// 由 HTML 页面按钮触发执行，不要在此自动执行
// execute().catch((e) => {
//   console.error(`执行异常: ${e.message}\n${e.stack}`);
// });
