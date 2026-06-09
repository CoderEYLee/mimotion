/**
 * 小米运动/Zepp Life 自动刷步数 - JavaScript 实现
 *
 * 功能概述：
 *   1. 通过 AES 加密登录 Zepp API，获取 access_token
 *   2. 通过 access_token 获取 login_token、app_token、user_id
 *   3. 使用 app_token 提交伪造的步数数据到华米接口
 *   4. 支持 Token 缓存（AES 加密存储到本地文件），避免频繁登录
 *   5. 支持多渠道推送：PushPlus、企业微信 Webhook、飞书 Webhook、Telegram Bot
 *
 * 依赖：Node.js >= 18（内置 fetch、crypto）
 *
 * 用法：
 *   node mimotion.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 加载 .env 文件（无需 dotenv 依赖）
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val; // 不覆盖已有的系统环境变量
  }
})();

// ========== 全局配置 ==========
const AES_KEY = Buffer.from(process.env.AES_KEY || '', 'utf-8'); // AES 加密密钥，用于 token 缓存（必须为16字节）
const TOKEN_CACHE_FILE = 'encrypted_tokens_js.data';             // token 缓存文件名

// ============================================================================
// 运动数据模板（硬编码）
// URL 编码的 JSON 数组，包含心率、步数等伪造运动数据
// 提交时需替换其中的日期（date）和步数（ttl）字段
// ============================================================================
const BAND_DATA_TEMPLATE = `%5B%7B%22data_hr%22%3A%22%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9L%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FVv%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0v%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9e%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0n%5C%2Fa%5C%2F%5C%2F%5C%2FS%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0b%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F1FK%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FR%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9PTFFpaf9L%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FR%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0j%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9K%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FOv%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2Fzf%5C%2F%5C%2F%5C%2F86%5C%2Fzr%5C%2FOv88%5C%2Fzf%5C%2FPf%5C%2F%5C%2F%5C%2F0v%5C%2FS%5C%2F8%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FSf%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2Fz3%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0r%5C%2FOv%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FS%5C%2F9L%5C%2Fzb%5C%2FSf9K%5C%2F0v%5C%2FRf9H%5C%2Fzj%5C%2FSf9K%5C%2F0%5C%2F%5C%2FN%5C%2F%5C%2F%5C%2F%5C%2F0D%5C%2FSf83%5C%2Fzr%5C%2FPf9M%5C%2F0v%5C%2FOv9e%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FS%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2Fzv%5C%2F%5C%2Fz7%5C%2FO%5C%2F83%5C%2Fzv%5C%2FN%5C%2F83%5C%2Fzr%5C%2FN%5C%2F86%5C%2Fz%5C%2F%5C%2FNv83%5C%2Fzn%5C%2FXv84%5C%2Fzr%5C%2FPP84%5C%2Fzj%5C%2FN%5C%2F9e%5C%2Fzr%5C%2FN%5C%2F89%5C%2F03%5C%2FP%5C%2F89%5C%2Fz3%5C%2FQ%5C%2F9N%5C%2F0v%5C%2FTv9C%5C%2F0H%5C%2FOf9D%5C%2Fzz%5C%2FOf88%5C%2Fz%5C%2F%5C%2FPP9A%5C%2Fzr%5C%2FN%5C%2F86%5C%2Fzz%5C%2FNv87%5C%2F0D%5C%2FOv84%5C%2F0v%5C%2FO%5C%2F84%5C%2Fzf%5C%2FMP83%5C%2FzH%5C%2FNv83%5C%2Fzf%5C%2FN%5C%2F84%5C%2Fzf%5C%2FOf82%5C%2Fzf%5C%2FOP83%5C%2Fzb%5C%2FMv81%5C%2FzX%5C%2FR%5C%2F9L%5C%2F0v%5C%2FO%5C%2F9I%5C%2F0T%5C%2FS%5C%2F9A%5C%2Fzn%5C%2FPf89%5C%2Fzn%5C%2FNf9K%5C%2F07%5C%2FN%5C%2F83%5C%2Fzn%5C%2FNv83%5C%2Fzv%5C%2FO%5C%2F9A%5C%2F0H%5C%2FOf8%5C%2F%5C%2Fzj%5C%2FPP83%5C%2Fzj%5C%2FS%5C%2F87%5C%2Fzj%5C%2FNv84%5C%2Fzf%5C%2FOf83%5C%2Fzf%5C%2FOf83%5C%2Fzb%5C%2FNv9L%5C%2Fzj%5C%2FNv82%5C%2Fzb%5C%2FN%5C%2F85%5C%2Fzf%5C%2FN%5C%2F9J%5C%2Fzf%5C%2FNv83%5C%2Fzj%5C%2FNv84%5C%2F0r%5C%2FSv83%5C%2Fzf%5C%2FMP%5C%2F%5C%2F%5C%2Fzb%5C%2FMv82%5C%2Fzb%5C%2FOf85%5C%2Fz7%5C%2FNv8%5C%2F%5C%2F0r%5C%2FS%5C%2F85%5C%2F0H%5C%2FQP9B%5C%2F0D%5C%2FNf89%5C%2Fzj%5C%2FOv83%5C%2Fzv%5C%2FNv8%5C%2F%5C%2F0f%5C%2FSv9O%5C%2F0ZeXv%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F1X%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9B%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2FTP%5C%2F%5C%2F%5C%2F1b%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F0%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F9N%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2F%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%5C%2Fv7%2B%22%2C%22date%22%3A%222021-08-07%22%2C%22data%22%3A%5B%7B%22start%22%3A0%2C%22stop%22%3A1439%2C%22value%22%3A%22UA8AUBQAUAwAUBoAUAEAYCcAUBkAUB4AUBgAUCAAUAEAUBkAUAwAYAsAYB8AYB0AYBgAYCoAYBgAYB4AUCcAUBsAUB8AUBwAUBIAYBkAYB8AUBoAUBMAUCEAUCIAYBYAUBwAUCAAUBgAUCAAUBcAYBsAYCUAATIPYD0KECQAYDMAYB0AYAsAYCAAYDwAYCIAYB0AYBcAYCQAYB0AYBAAYCMAYAoAYCIAYCEAYCYAYBsAYBUAYAYAYCIAYCMAUB0AUCAAUBYAUCoAUBEAUC8AUB0AUBYAUDMAUDoAUBkAUC0AUBQAUBwAUA0AUBsAUAoAUCEAUBYAUAwAUB4AUAwAUCcAUCYAUCwKYDUAAUUlEC8IYEMAYEgAYDoAYBAAUAMAUBkAWgAAWgAAWgAAWgAAWgAAUAgAWgAAUBAAUAQAUA4AUA8AUAkAUAIAUAYAUAcAUAIAWgAAUAQAUAkAUAEAUBkAUCUAWgAAUAYAUBEAWgAAUBYAWgAAUAYAWgAAWgAAWgAAWgAAUBcAUAcAWgAAUBUAUAoAUAIAWgAAUAQAUAYAUCgAWgAAUAgAWgAAWgAAUAwAWwAAXCMAUBQAWwAAUAIAWgAAWgAAWgAAWgAAWgAAWgAAWgAAWgAAWREAWQIAUAMAWSEAUDoAUDIAUB8AUCEAUC4AXB4AUA4AWgAAUBIAUA8AUBAAUCUAUCIAUAMAUAEAUAsAUAMAUCwAUBYAWgAAWgAAWgAAWgAAWgAAWgAAUAYAWgAAWgAAWgAAUAYAWwAAWgAAUAYAXAQAUAMAUBsAUBcAUCAAWwAAWgAAWgAAWgAAWgAAUBgAUB4AWgAAUAcAUAwAWQIAWQkAUAEAUAIAWgAAUAoAWgAAUAYAUB0AWgAAWgAAUAkAWgAAWSwAUBIAWgAAUC4AWSYAWgAAUAYAUAoAUAkAUAIAUAcAWgAAUAEAUBEAUBgAUBcAWRYAUA0AWSgAUB4AUDQAUBoAXA4AUA8AUBwAUA8AUA4AUA4AWgAAUAIAUCMAWgAAUCwAUBgAUAYAUAAAUAAAUAAAUAAAUAAAUAAAUAAAUAAAUAAAWwAAUAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAeSEAeQ8AcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBcAcAAAcAAAcCYOcBUAUAAAUAAAUAAAUAAAUAUAUAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcCgAeQAAcAAAcAAAcAAAcAAAcAAAcAYAcAAAcBgAeQAAcAAAcAAAegAAegAAcAAAcAcAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcCkAeQAAcAcAcAAAcAAAcAwAcAAAcAAAcAIAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcCIAeQAAcAAAcAAAcAAAcAAAcAAAeRwAeQAAWgAAUAAAUAAAUAAAUAAAUAAAcAAAcAAAcBoAeScAeQAAegAAcBkAeQAAUAAAUAAAUAAAUAAAUAAAUAAAcAAAcAAAcAAAcAAAcAAAcAAAegAAegAAcAAAcAAAcBgAeQAAcAAAcAAAcAAAcAAAcAAAcAkAegAAegAAcAcAcAAAcAcAcAAAcAAAcAAAcAAAcA8AeQAAcAAAcAAAeRQAcAwAUAAAUAAAUAAAUAAAUAAAUAAAcAAAcBEAcA0AcAAAWQsAUAAAUAAAUAAAUAAAUAAAcAAAcAoAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAYAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBYAegAAcAAAcAAAegAAcAcAcAAAcAAAcAAAcAAAcAAAeRkAegAAegAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAEAcAAAcAAAcAAAcAUAcAQAcAAAcBIAeQAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBsAcAAAcAAAcBcAeQAAUAAAUAAAUAAAUAAAUAAAUBQAcBYAUAAAUAAAUAoAWRYAWTQAWQAAUAAAUAAAUAAAcAAAcAAAcAAAcAAAcAAAcAMAcAAAcAQAcAAAcAAAcAAAcDMAeSIAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcBQAeQwAcAAAcAAAcAAAcAMAcAAAeSoAcA8AcDMAcAYAeQoAcAwAcFQAcEMAeVIAaTYAbBcNYAsAYBIAYAIAYAIAYBUAYCwAYBMAYDYAYCkAYDcAUCoAUCcAUAUAUBAAWgAAYBoAYBcAYCgAUAMAUAYAUBYAUA4AUBgAUAgAUAgAUAsAUAsAUA4AUAMAUAYAUAQAUBIAASsSUDAAUDAAUBAAYAYAUBAAUAUAUCAAUBoAUCAAUBAAUAoAYAIAUAQAUAgAUCcAUAsAUCIAUCUAUAoAUA4AUB8AUBkAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAAfgAA%22%2C%22tz%22%3A32%2C%22did%22%3A%22DA932FFFFE8816E7%22%2C%22src%22%3A24%7D%5D%2C%22summary%22%3A%22%7B%5C%22v%5C%22%3A6%2C%5C%22slp%5C%22%3A%7B%5C%22st%5C%22%3A1628296479%2C%5C%22ed%5C%22%3A1628296479%2C%5C%22dp%5C%22%3A0%2C%5C%22lt%5C%22%3A0%2C%5C%22wk%5C%22%3A0%2C%5C%22usrSt%5C%22%3A-1440%2C%5C%22usrEd%5C%22%3A-1440%2C%5C%22wc%5C%22%3A0%2C%5C%22is%5C%22%3A0%2C%5C%22lb%5C%22%3A0%2C%5C%22to%5C%22%3A0%2C%5C%22dt%5C%22%3A0%2C%5C%22rhr%5C%22%3A0%2C%5C%22ss%5C%22%3A0%7D%2C%5C%22stp%5C%22%3A%7B%5C%22ttl%5C%22%3A18272%2C%5C%22dis%5C%22%3A10627%2C%5C%22cal%5C%22%3A510%2C%5C%22wk%5C%22%3A41%2C%5C%22rn%5C%22%3A50%2C%5C%22runDist%5C%22%3A7654%2C%5C%22runCal%5C%22%3A397%2C%5C%22stage%5C%22%3A%5B%7B%5C%22start%5C%22%3A327%2C%5C%22stop%5C%22%3A341%2C%5C%22mode%5C%22%3A1%2C%5C%22dis%5C%22%3A481%2C%5C%22cal%5C%22%3A13%2C%5C%22step%5C%22%3A680%7D%2C%7B%5C%22start%5C%22%3A342%2C%5C%22stop%5C%22%3A367%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A2295%2C%5C%22cal%5C%22%3A95%2C%5C%22step%5C%22%3A2874%7D%2C%7B%5C%22start%5C%22%3A368%2C%5C%22stop%5C%22%3A377%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A1592%2C%5C%22cal%5C%22%3A88%2C%5C%22step%5C%22%3A1664%7D%2C%7B%5C%22start%5C%22%3A378%2C%5C%22stop%5C%22%3A386%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A1072%2C%5C%22cal%5C%22%3A51%2C%5C%22step%5C%22%3A1245%7D%2C%7B%5C%22start%5C%22%3A387%2C%5C%22stop%5C%22%3A393%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A1036%2C%5C%22cal%5C%22%3A57%2C%5C%22step%5C%22%3A1124%7D%2C%7B%5C%22start%5C%22%3A394%2C%5C%22stop%5C%22%3A398%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A488%2C%5C%22cal%5C%22%3A19%2C%5C%22step%5C%22%3A607%7D%2C%7B%5C%22start%5C%22%3A399%2C%5C%22stop%5C%22%3A414%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A2220%2C%5C%22cal%5C%22%3A120%2C%5C%22step%5C%22%3A2371%7D%2C%7B%5C%22start%5C%22%3A415%2C%5C%22stop%5C%22%3A427%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A1268%2C%5C%22cal%5C%22%3A59%2C%5C%22step%5C%22%3A1489%7D%2C%7B%5C%22start%5C%22%3A428%2C%5C%22stop%5C%22%3A433%2C%5C%22mode%5C%22%3A1%2C%5C%22dis%5C%22%3A152%2C%5C%22cal%5C%22%3A4%2C%5C%22step%5C%22%3A238%7D%2C%7B%5C%22start%5C%22%3A434%2C%5C%22stop%5C%22%3A444%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A2295%2C%5C%22cal%5C%22%3A95%2C%5C%22step%5C%22%3A2874%7D%2C%7B%5C%22start%5C%22%3A445%2C%5C%22stop%5C%22%3A455%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A1592%2C%5C%22cal%5C%22%3A88%2C%5C%22step%5C%22%3A1664%7D%2C%7B%5C%22start%5C%22%3A456%2C%5C%22stop%5C%22%3A466%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A1072%2C%5C%22cal%5C%22%3A51%2C%5C%22step%5C%22%3A1245%7D%2C%7B%5C%22start%5C%22%3A467%2C%5C%22stop%5C%22%3A477%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A1036%2C%5C%22cal%5C%22%3A57%2C%5C%22step%5C%22%3A1124%7D%2C%7B%5C%22start%5C%22%3A478%2C%5C%22stop%5C%22%3A488%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A488%2C%5C%22cal%5C%22%3A19%2C%5C%22step%5C%22%3A607%7D%2C%7B%5C%22start%5C%22%3A489%2C%5C%22stop%5C%22%3A499%2C%5C%22mode%5C%22%3A4%2C%5C%22dis%5C%22%3A2220%2C%5C%22cal%5C%22%3A120%2C%5C%22step%5C%22%3A2371%7D%2C%7B%5C%22start%5C%22%3A500%2C%5C%22stop%5C%22%3A511%2C%5C%22mode%5C%22%3A3%2C%5C%22dis%5C%22%3A1268%2C%5C%22cal%5C%22%3A59%2C%5C%22step%5C%22%3A1489%7D%2C%7B%5C%22start%5C%22%3A512%2C%5C%22stop%5C%22%3A522%2C%5C%22mode%5C%22%3A1%2C%5C%22dis%5C%22%3A152%2C%5C%22cal%5C%22%3A4%2C%5C%22step%5C%22%3A238%7D%5D%7D%2C%5C%22goal%5C%22%3A8000%2C%5C%22tz%5C%22%3A%5C%2228800%5C%22%7D%22%2C%22source%22%3A24%2C%22type%22%3A0%7D%5D`;

// ============================================================================
// AES 加解密模块
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
  return Buffer.concat([data, Buffer.alloc(padLen, padLen)]);
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
  const padLen = data[data.length - 1];
  if (padLen < 1 || padLen > AES_BLOCK_SIZE) {
    throw new Error(`无效的填充长度: ${padLen}`);
  }
  for (let i = data.length - padLen; i < data.length; i++) {
    if (data[i] !== padLen) {
      throw new Error('无效的 PKCS#7 填充');
    }
  }
  return data.subarray(0, data.length - padLen);
}

/**
 * AES-128-CBC 加密
 * @param {Buffer} plain - 明文
 * @param {Buffer} key - 16 字节密钥
 * @param {Buffer|null} iv - IV 向量，为 null 时生成随机 IV
 * @returns {Buffer} iv+ciphertext（随机IV时）或仅 ciphertext（固定IV时）
 */
function encryptData(plain, key, iv = null) {
  if (!Buffer.isBuffer(key) || key.length !== 16) {
    throw new Error('密钥必须为 16 字节');
  }
  if (!Buffer.isBuffer(plain)) {
    throw new Error('明文必须为 Buffer');
  }
  const padded = pkcs7Pad(plain);
  if (iv === null) {
    // 随机 IV，返回 IV + 密文
    const randomIv = crypto.randomBytes(AES_BLOCK_SIZE);
    const cipher = crypto.createCipheriv('aes-128-cbc', key, randomIv);
    cipher.setAutoPadding(false); // 已手动 PKCS#7 填充，关闭自动填充
    const ciphertext = Buffer.concat([cipher.update(padded), cipher.final()]);
    return Buffer.concat([randomIv, ciphertext]);
  } else {
    // 固定 IV，仅返回密文
    if (!Buffer.isBuffer(iv) || iv.length !== AES_BLOCK_SIZE) {
      throw new Error(`IV 必须为 ${AES_BLOCK_SIZE} 字节`);
    }
    const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
    cipher.setAutoPadding(false); // 已手动 PKCS#7 填充，关闭自动填充
    return Buffer.concat([cipher.update(padded), cipher.final()]);
  }
}

/**
 * AES-128-CBC 解密
 * @param {Buffer} data - 密文数据（随机IV时含前16字节IV，固定IV时仅密文）
 * @param {Buffer} key - 16 字节密钥
 * @param {Buffer|null} iv - IV 向量，为 null 时从数据前16字节提取
 * @returns {Buffer} 明文
 */
function decryptData(data, key, iv = null) {
  if (!Buffer.isBuffer(key) || key.length !== 16) {
    throw new Error('密钥必须为 16 字节');
  }
  if (!Buffer.isBuffer(data)) {
    throw new Error('数据必须为 Buffer');
  }
  let actualIv, ciphertext;
  if (iv === null) {
    if (data.length < AES_BLOCK_SIZE) throw new Error('数据过短');
    actualIv = data.subarray(0, AES_BLOCK_SIZE);
    ciphertext = data.subarray(AES_BLOCK_SIZE);
  } else {
    if (!Buffer.isBuffer(iv) || iv.length !== AES_BLOCK_SIZE) {
      throw new Error(`IV 必须为 ${AES_BLOCK_SIZE} 字节`);
    }
    actualIv = iv;
    ciphertext = data;
  }
  if (ciphertext.length === 0 || ciphertext.length % AES_BLOCK_SIZE !== 0) {
    throw new Error('无效的密文长度');
  }
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, actualIv);
  decipher.setAutoPadding(false); // 已手动 PKCS#7 去填充，关闭自动去填充
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return pkcs7Unpad(decrypted);
}

/** Buffer 转 Base64 */
function bytesToBase64(data) { return data.toString('base64'); }

/** Base64 转 Buffer */
function base64ToBytes(data) { return Buffer.from(data, 'base64'); }

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
function uuid() { return crypto.randomUUID(); }

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
  const cipherData = encryptData(plaintext, HM_AES_KEY, HM_AES_IV);

  const url = 'https://api-user.zepp.com/v2/registrations/tokens';
  try {
    console.log(`[Zepp] 登录请求: POST ${url}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: cipherData,
      redirect: 'manual', // 不自动跟随重定向，需要从 303 的 Location 头提取 token
    });
    if (resp.status !== 303) {
      console.log(`[Zepp] 登录异常, status: ${resp.status}`);
      return [null, `登录异常，status: ${resp.status}`];
    }
    const location = resp.headers.get('Location') || '';
    const code = getAccessToken(location);
    if (!code) {
      const errorCode = getErrorCode(location);
      console.log(`[Zepp] 获取 accessToken 失败, error: ${errorCode}`);
      return [null, `获取accessToken失败: ${errorCode}`];
    }
    console.log(`[Zepp] 登录成功, accessToken 长度=${code.length}`);
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
    console.log(`[Zepp] 客户端登录请求: POST ${url} (${isPhone ? '手机号' : '邮箱'})`);
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: new URLSearchParams(data).toString(),
    });
    const respJson = await resp.json();
    if (respJson.result !== 'ok') {
      console.log(`[Zepp] 客户端登录失败: result=${respJson.result}`);
      return [null, null, null, `客户端登录失败: ${respJson.result}`];
    }
    const { login_token, app_token, user_id } = respJson.token_info;
    console.log(`[Zepp] 客户端登录成功: user_id=${user_id}`);
    return [login_token, app_token, user_id, null];
  } catch (e) {
    console.log(`[Zepp] 客户端登录异常: ${e.message}`);
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
  const url = `https://account-cn.huami.com/v1/client/app_tokens?app_name=com.xiaomi.hm.health&dn=api-user.huami.com%2Capi-mifit.huami.com%2Capp-analytics.huami.com&login_token=${loginToken}`;
  const headers = { 'User-Agent': 'MiFit/5.3.0 (iPhone; iOS 14.7.1; Scale/3.00)' };

  try {
    console.log(`[Zepp] 刷新 app_token 请求: GET account-cn.huami.com`);
    const resp = await fetch(url, { headers });
    if (resp.status !== 200) {
      console.log(`[Zepp] 刷新 app_token 异常: status=${resp.status}`);
      return [null, `请求异常: ${resp.status}`];
    }
    const respJson = await resp.json();
    if (respJson.result !== 'ok') {
      console.log(`[Zepp] 刷新 app_token 失败: ${respJson.error_code}`);
      return [null, `请求失败: ${respJson.error_code}`];
    }
    console.log(`[Zepp] 刷新 app_token 成功`);
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
    const resp = await fetch(`${url}?${params.toString()}`, { headers });
    if (resp.status !== 200) {
      console.log(`[Zepp] 检查 app_token 异常: status=${resp.status}`);
      return [false, `请求异常: ${resp.status}`];
    }
    const respJson = await resp.json();
    const isValid = respJson.message === 'success';
    console.log(`[Zepp] app_token ${isValid ? '有效' : '无效'}`);
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
    console.log(`[Zepp] 刷新 login_token 请求: GET account-cn3.zepp.com`);
    const resp = await fetch(`${url}?${params.toString()}`, { headers });
    if (resp.status !== 200) {
      console.log(`[Zepp] 刷新 login_token 异常: status=${resp.status}`);
      return [null, `请求异常: ${resp.status}`];
    }
    const respJson = await resp.json();
    if (respJson.result !== 'ok') {
      console.log(`[Zepp] 刷新 login_token 失败: ${respJson.result}`);
      return [null, `请求失败: ${respJson.result}`];
    }
    console.log(`[Zepp] 刷新 login_token 成功`);
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
  const t = getTime();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let dataJson = BAND_DATA_TEMPLATE;

  // 使用正则替换模板中的日期（匹配 date%22%3A%22...%22%2C%22data 模式）
  const dateMatch = dataJson.match(/.*?date%22%3A%22(.*?)%22%2C%22data.*?/);
  if (dateMatch) {
    dataJson = dataJson.replace(dateMatch[1], today);
  } else {
    console.log(`[Zepp] 警告: 模板中未匹配到日期字段`);
  }

  // 使用正则替换模板中的步数（匹配 ttl%5C%22%3A...%2C%5C%22dis 模式）
  const stepMatch = dataJson.match(/.*?ttl%5C%22%3A(.*?)%2C%5C%22dis.*?/);
  if (stepMatch) {
    dataJson = dataJson.replace(stepMatch[1], step);
  } else {
    console.log(`[Zepp] 警告: 模板中未匹配到步数字段`);
  }

  const url = `https://api-mifit-cn.huami.com/v1/data/band_data.json?&t=${t}&r=${uuid()}`;
  const headers = {
    'apptoken': appToken,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const body = `userid=${userid}&last_sync_data_time=1597306380&device_type=0&last_deviceid=DA932FFFFE8816E7&data_json=${dataJson}`;

  try {
    console.log(`[Zepp] 提交步数请求: POST api-mifit-cn.huami.com, step=${step}, date=${today}`);
    const resp = await fetch(url, { method: 'POST', headers, body });
    if (resp.status !== 200) {
      console.log(`[Zepp] 提交步数异常: status=${resp.status}`);
      return [false, `请求修改步数异常: ${resp.status}`];
    }
    const respJson = await resp.json();
    const success = respJson.message === 'success';
    console.log(`[Zepp] 提交步数${success ? '成功' : '失败'}: ${respJson.message}`);
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
  const url = 'http://www.pushplus.plus/send';
  const data = new URLSearchParams({
    token, title, content,
    template: 'html',
    channel: 'wechat',
  });
  try {
    console.log(`[Push] PushPlus 推送: ${title}`);
    const resp = await fetch(url, { method: 'POST', body: data.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    if (resp.status === 200) {
      const json = await resp.json();
      console.log(`[Push] PushPlus: ${json.code}-${json.msg}`);
    } else {
      const text = await resp.text();
      console.log(`[Push] PushPlus 失败: status=${resp.status}, body=${text}`);
    }
  } catch (e) {
    console.log(`[Push] PushPlus 异常: ${e.message}`);
  }
}

/**
 * 企业微信 Webhook 推送（Markdown 格式）
 * @param {string} key - Webhook 机器人的 key
 * @param {string} title - 推送标题
 * @param {string} content - 推送内容
 */
async function pushWechatWebhook(key, title, content) {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`;
  const payload = {
    msgtype: 'markdown_v2',
    markdown_v2: { content: `# ${title}\n${content}` },
  };
  try {
    console.log(`[Push] 企业微信推送: ${title}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.status === 200) {
      const json = await resp.json();
      console.log(`[Push] 企业微信: ${json.errmsg}`);
    } else {
      const text = await resp.text();
      console.log(`[Push] 企业微信失败: status=${resp.status}, body=${text}`);
    }
  } catch (e) {
    console.log(`[Push] 企业微信异常: ${e.message}`);
  }
}

/**
 * 飞书 Webhook 推送（文本格式）
 * @param {string} key - Webhook 机器人的 key
 * @param {string} title - 推送标题
 * @param {string} content - 推送内容
 */
async function pushFeishuWebhook(key, title, content) {
  const url = `https://open.feishu.cn/open-apis/bot/v2/hook/${key}`;
  const payload = {
    msg_type: 'text',
    content: { text: `# ${title}\n${content}` },
  };
  try {
    console.log(`[Push] 飞书推送: ${title}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.status === 200) {
      const json = await resp.json();
      console.log(`[Push] 飞书: ${json.msg}`);
    } else {
      const text = await resp.text();
      console.log(`[Push] 飞书失败: status=${resp.status}, body=${text}`);
    }
  } catch (e) {
    console.log(`[Push] 飞书异常: ${e.message}`);
  }
}

/**
 * Telegram Bot 推送（HTML 格式）
 * @param {string} botToken - Telegram Bot Token
 * @param {string} chatId - Telegram Chat ID
 * @param {string} content - HTML 格式内容
 */
async function pushTelegramBot(botToken, chatId, content) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: parseInt(chatId),
    text: content,
    parse_mode: 'HTML',
  };
  try {
    console.log(`[Push] Telegram 推送: chatId=${chatId}`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.status === 200) {
      const json = await resp.json();
      console.log(json.ok ? `[Push] Telegram: message_id=${json.result.message_id}` : `[Push] Telegram 失败: ${JSON.stringify(json)}`);
    } else {
      const text = await resp.text();
      console.log(`[Push] Telegram 失败: status=${resp.status}, body=${text}`);
    }
  } catch (e) {
    console.log(`[Push] Telegram 异常: ${e.message}`);
  }
}

/**
 * 检查是否在推送时间范围内
 * 如果配置了 pushPlusHour，则只在指定整点推送
 * @param {PushConfig} config - 推送配置
 * @returns {boolean} true 表示不在推送时间，跳过推送
 */
function notInPushTimeRange(config) {
  if (!config.pushPlusHour) return false; // 未设置则总是推送

  const timeBj = getBeijingTime();

  // 首先检查当前小时是否匹配
  if (/^\d+$/.test(config.pushPlusHour)) {
    if (timeBj.getHours() === parseInt(config.pushPlusHour)) {
      console.log(`当前设置推送整点为：${config.pushPlusHour}, 当前整点为：${timeBj.getHours()}，执行推送`);
      return false;
    }
  }

  // 检查 cron_change_time 文件中的记录，避免 Actions 执行延迟导致推送失效
  try {
    const cronFile = path.join(__dirname, 'cron_change_time');
    if (fs.existsSync(cronFile)) {
      const lines = fs.readFileSync(cronFile, 'utf-8').split('\n');
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1].trim();
        const match = lastLine.match(/北京时间\(0?(\d+):\d+\)/);
        if (match) {
          const cronHour = parseInt(match[1]);
          if (parseInt(config.pushPlusHour) === cronHour) {
            console.log(`当前设置推送整点为：${config.pushPlusHour}, 根据执行记录，本次执行整点为：${cronHour}，执行推送`);
            return false;
          }
        }
      }
    }
  } catch (e) {
    console.log(`读取cron_change_time文件出错: ${e.message}`);
  }

  console.log(`当前整点时间为：${formatNow()}，不在配置的推送时间，不执行推送`);
  return true;
}

/**
 * 推送所有执行结果到各个渠道
 * @param {Array} execResults - 执行结果数组
 * @param {string} summary - 汇总信息
 * @param {PushConfig} config - 推送配置
 */
async function pushResults(execResults, summary, config) {
  if (notInPushTimeRange(config)) return;

  const title = `${formatNow()} 刷步数通知`;

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
    await pushPlus(config.pushPlusToken, title, html);
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
    await pushWechatWebhook(config.pushWechatWebhookKey, title, content);
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
    await pushFeishuWebhook(config.pushFeishuWebhookKey, title, content);
  }
}

// ============================================================================
// Token 持久化模块（AES 加密存储到本地文件）
// ============================================================================

/**
 * 从加密文件加载已保存的 token 数据
 *
 * 从本地加密文件加载已缓存的 token 数据。
 * 文件格式：随机IV(16字节) + AES-128-CBC密文
 *
 * @param {string} dataPath - 加密数据文件路径
 * @param {Buffer} aesKey - AES 密钥（16字节）
 * @returns {object} token 数据字典，格式为 { "账号": { access_token, login_token, app_token, user_id, ... } }
 */
function prepareUserTokens(dataPath, aesKey) {
  if (!fs.existsSync(dataPath)) {
    console.log(`[Token] 缓存文件不存在, 跳过加载`);
    return {};
  }
  try {
    const data = fs.readFileSync(dataPath);
    const decrypted = decryptData(data, aesKey, null);
    const tokens = JSON.parse(decrypted.toString('utf-8'));
    const userCount = Object.keys(tokens).length;
    console.log(`[Token] 缓存加载成功, 共 ${userCount} 个账号`);
    return tokens;
  } catch (e) {
    console.log(`[Token] 缓存解密失败（密钥不正确或文件损坏）: ${e.message}`);
    return {};
  }
}

/**
 * 将 token 数据加密保存到本地文件
 *
 * @param {string} dataPath - 加密数据文件路径
 * @param {object} userTokens - token 数据字典
 * @param {Buffer} aesKey - AES 密钥（16字节）
 */
function persistUserTokens(dataPath, userTokens, aesKey) {
  const userCount = Object.keys(userTokens).length;
  const originStr = JSON.stringify(userTokens);
  const cipherData = encryptData(Buffer.from(originStr, 'utf-8'), aesKey, null);
  fs.writeFileSync(dataPath, cipherData);
  console.log(`[Token] 缓存已保存, ${userCount} 个账号, 文件大小=${cipherData.length} 字节`);
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
   * @param {Buffer|null} aesKey - AES 加密密钥
   */
  constructor(user, passwd, userTokens, aesKey) {
    this.userTokens = userTokens;
    this.aesKey = aesKey;
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
    console.log(`[Runner] 初始化: 账号=${desensitizeUserName(this.user)}, 类型=${this.isPhone ? '手机号' : '邮箱'}`);
  }

  /**
   * 登录获取 app_token
   * 优先使用缓存的 token，逐级尝试：app_token → login_token → access_token
   * @returns {Promise<string|null>} app_token 或 null
   */
  async login() {
    console.log(`[Runner] 开始登录: ${desensitizeUserName(this.user)}`);
    const tokenInfo = this.userTokens[this.user];

    if (tokenInfo) {
      let accessToken = tokenInfo.access_token;
      let loginToken = tokenInfo.login_token;
      let appToken = tokenInfo.app_token;
      this.deviceId = tokenInfo.device_id || uuid();
      this.userId = tokenInfo.user_id;

      // 第一级：检查 app_token 是否有效
      const [ok, msg] = await checkAppToken(appToken);
      if (ok) {
        this.logStr += '使用缓存的 app_token\n';
        console.log(`[Runner] 缓存 app_token 有效，直接使用`);
        return appToken;
      }
      this.logStr += `app_token 失效, last grant: ${tokenInfo.app_token_time}\n`;

      // 第二级：用 login_token 刷新 app_token
      console.log(`[Runner] app_token 已失效，尝试 login_token 刷新`);
      const [newAppToken, msg2] = await grantAppToken(loginToken);
      if (newAppToken) {
        this.logStr += '刷新 app_token 成功\n';
        tokenInfo.app_token = newAppToken;
        tokenInfo.app_token_time = getTime();
        return newAppToken;
      }
      this.logStr += `login_token 失效, last grant: ${tokenInfo.login_token_time}\n`;

      // 第三级：用 access_token 重新获取所有 token
      console.log(`[Runner] login_token 已失效，尝试 access_token 重新获取`);
      const [newLoginToken, newAppToken2, userId, msg3] = await grantLoginTokens(accessToken, this.deviceId, this.isPhone);
      if (newLoginToken) {
        tokenInfo.login_token = newLoginToken;
        tokenInfo.app_token = newAppToken2;
        tokenInfo.user_id = userId;
        tokenInfo.login_token_time = getTime();
        tokenInfo.app_token_time = getTime();
        this.userId = userId;
        console.log(`[Runner] access_token 重新获取成功`);
        return newAppToken2;
      }
      this.logStr += `access_token 失效: ${msg3}, last grant: ${tokenInfo.access_token_time}\n`;
      console.log(`[Runner] 所有缓存 token 均已失效，重新登录`);
    } else {
      console.log(`[Runner] 无缓存，完整登录`);
    }

    // 没有缓存或全部失效，从头登录
    const [accessToken, errMsg] = await loginAccessToken(this.user, this.password);
    if (!accessToken) {
      this.logStr += `登录失败: ${errMsg}`;
      console.log(`[Runner] 登录失败: ${errMsg}`);
      return null;
    }

    const [loginToken, appToken, userId, errMsg2] = await grantLoginTokens(accessToken, this.deviceId, this.isPhone);
    if (!loginToken) {
      this.logStr += `获取 login_token 失败: ${errMsg2}`;
      console.log(`[Runner] 获取 login_token 失败: ${errMsg2}`);
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
    console.log(`[Runner] 登录成功, userId=${userId}`);
    return appToken;
  }

  /**
   * 登录并提交步数
   * @param {number} minStep - 最小步数
   * @param {number} maxStep - 最大步数
   * @returns {Promise<[string, boolean]>} [执行消息, 是否成功]
   */
  async loginAndPostStep(minStep, maxStep) {
    if (this.invalid) {
      console.log(`[Runner] 账号无效, 跳过执行`);
      return ['账号或密码配置有误', false];
    }

    const appToken = await this.login();
    if (!appToken) {
      console.log(`[Runner] 登录失败, 无法提交步数`);
      return ['登录失败！', false];
    }

    const step = String(randomInt(minStep, maxStep));
    this.logStr += `步数范围(${minStep}~${maxStep}), 随机值:${step}\n`;

    const [ok, msg] = await postFakeBrandData(step, appToken, this.userId);
    return [`修改步数（${step}）[${msg}]`, ok];
  }
}

/**
 * 主执行函数：登录并提交步数，推送结果
 */
async function execute() {
  console.log(`[Main] 开始执行, ${formatNow()}`);

  const encryptSupport = AES_KEY.length === 16;
  let userTokens = {};
  const dataPath = path.join(__dirname, TOKEN_CACHE_FILE);

  if (encryptSupport) {
    userTokens = prepareUserTokens(dataPath, AES_KEY);
  } else {
    console.log('[Main] AES_KEY 无效（长度必须为16字节）, 无法使用加密保存功能');
  }

  const pushConfig = new PushConfig({
    pushPlusToken: process.env.PUSH_PLUS_TOKEN || "",
    pushPlusHour: process.env.PUSH_PLUS_HOUR || "",
    pushPlusMax: process.env.PUSH_PLUS_MAX || 30,
    pushWechatWebhookKey: process.env.WECHAT_WEBHOOK_KEY || "",
    pushFeishuWebhookKey: process.env.FEISHU_WEBHOOK_KEY || "",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
    telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  });

  const user = process.env.ZEPP_USER || "";
  const password = process.env.ZEPP_PASSWORD || "";
  if (!user || !password) {
    console.log('[Main] 未正确配置账号密码（ZEPP_USER / ZEPP_PASSWORD），无法执行');
    process.exit(1);
  }

  const timeBj = getBeijingTime();
  const stepConfig = { MIN_STEP: 20000, MAX_STEP: 21000 };
  const [minStep, maxStep] = getMinMaxByTime(timeBj.getHours(), timeBj.getMinutes(), stepConfig);
  console.log(`[Main] 步数范围: ${minStep}~${maxStep}`);

  let logStr = `[${formatNow()}]\n账号：${desensitizeUserName(user)}\n`;
  let execResult;

  try {
    const runner = new MiMotionRunner(user, password, userTokens, null);
    const [execMsg, success] = await runner.loginAndPostStep(minStep, maxStep);
    logStr += runner.logStr + `${execMsg}\n`;
    console.log(logStr);
    execResult = { user, success, msg: execMsg };
  } catch (e) {
    logStr += `执行异常:${e.message}\n`;
    console.log(logStr);
    console.log(`[Main] 执行异常: ${e.message}`);
    execResult = { user, success: false, msg: `执行异常:${e.message}` };
  }

  const summary = `执行结果：${execResult.success ? '成功' : '失败'}, ${execResult.msg}`;
  console.log(`[Main] ${summary}`);

  if (encryptSupport) {
    persistUserTokens(dataPath, userTokens, AES_KEY);
  }

  await pushResults([execResult], summary, pushConfig);
}

// ============================================================================
// 入口
// ============================================================================

execute().catch((e) => {
  console.error(`执行异常: ${e.message}\n${e.stack}`);
  process.exit(1);
});
