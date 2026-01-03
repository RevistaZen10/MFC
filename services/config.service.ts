// Fix: Import process module to resolve Node.js-specific type errors.
import process from 'process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const CONFIG_FILE = path.join((process as any).cwd(), 'config.json');

export interface Config {
    geminiApiKey?: string;
    zenodoApiKey?: string;
    dailyAutomation?: boolean;
}

const question = (query: string, isSecret: boolean = false): Promise<string> => {
    const rl = readline.createInterface({ 
        input: (process as any).stdin, 
        output: (process as any).stdout 
    });
    
    if (isSecret && (process as any).stdout.isTTY) {
      const self = rl as any;
      self.output.write(query);
      self.history = self.history || [];
      self.history.unshift('');
      self.historyIndex = 0;
      self._ttyWrite = (d: any, key: any) => {
          key = key || {};
          if (key.name === 'return') {
              self.line = self.history[0];
              self.historyIndex = 0;
              self.close();
              return;
          }
          if (key.name === 'backspace') {
            if (self.history[0].length > 0) {
                self.history[0] = self.history[0].slice(0, -1);
                self.output.write('\b \b');
            }
            return;
          }
          // Only process strings, ignore other inputs.
          if (typeof d === 'string') {
            self.history[0] += d;
            self.output.write('*');
          }
      }
    }

    return new Promise(resolve => {
        if (!isSecret) {
            rl.question(query, (ans) => {
                rl.close();
                resolve(ans);
            });
        } else {
             // For secret input, the _ttyWrite hook is set up.
             // That hook calls rl.close() on 'return', which fires this event.
             rl.on('close', () => {
                 // The hook also sets rl.line with the captured secret.
                 (process as any).stdout.write('\n'); // Manually add a newline for clean output.
                 resolve((rl as any).line);
             });
             // We must manually start the prompt to begin listening for input.
             rl.prompt(true);
        }
    });
};

export function loadConfig(): Config {
    if (!fs.existsSync(CONFIG_FILE)) {
        return {};
    }
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading config file, starting fresh.', error);
        return {};
    }
}

export function saveConfig(config: Config): void {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        console.log('[INFO] Configuration saved to config.json');
    } catch (error) {
        console.error('Error saving config file.', error);
    }
}

export async function promptForApiKeys(force: boolean = false): Promise<Config> {
    let config = loadConfig();
    console.log("--- API Key Configuration ---");
    
    if (force || !config.geminiApiKey) {
        config.geminiApiKey = await question('[PROMPT] Enter your Google Gemini API Key: ', true);
    }

    if (force || !config.zenodoApiKey) {
        config.zenodoApiKey = await question('[PROMPT] Enter your Zenodo API Token: ', true);
    }

    saveConfig(config);
    return config;
}