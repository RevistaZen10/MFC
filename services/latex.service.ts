// Fix: Import process module to resolve Node.js-specific type errors.
import process from 'process';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import https from 'https';

const execAsync = promisify(exec);

const TINYTEX_INSTALL_SCRIPT_URL = 'https://raw.githubusercontent.com/yihui/tinytex/master/tools/install-unx.sh';
const TINYTEX_DIR = path.join((process as any).cwd(), 'tinytex');
const TINYTEX_PDFLATEX = path.join(TINYTEX_DIR, 'bin', 'pdflatex');

const question = (query: string): Promise<string> => {
    const rl = readline.createInterface({ input: (process as any).stdin, output: (process as any).stdout });
    return new Promise(resolve => rl.question(query, (ans) => {
        rl.close();
        resolve(ans);
    }));
};

async function commandExists(command: string): Promise<boolean> {
    try {
        const { stdout } = await execAsync((process as any).platform === 'win32' ? `where ${command}` : `command -v ${command}`);
        return !!stdout;
    } catch (e) {
        return false;
    }
}

async function installTinyTeX(): Promise<void> {
    console.log('[INFO] TinyTeX installation script starting...');
    if (fs.existsSync(TINYTEX_DIR)) {
        console.log('[INFO] TinyTeX directory already exists. Assuming it is installed.');
        return;
    }

    if ((process as any).platform === 'win32') {
         console.log('[INFO] Windows detected. Please install MiKTeX or another LaTeX distribution manually and ensure pdflatex is in your PATH.');
         throw new Error('Automatic LaTeX installation not supported on Windows. Please install it manually.');
    }

    console.log(`[INFO] Downloading installation script from ${TINYTEX_INSTALL_SCRIPT_URL}...`);
    const installScriptPath = path.join((process as any).cwd(), 'install-tinytex.sh');
    
    await new Promise<void>((resolve, reject) => {
        const file = fs.createWriteStream(installScriptPath);
        https.get(TINYTEX_INSTALL_SCRIPT_URL, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                fs.chmodSync(installScriptPath, '755');
                console.log('[SUCCESS] Download complete.');
                resolve();
            });
        }).on('error', (err) => {
            fs.unlinkSync(installScriptPath);
            reject(err);
        });
    });

    console.log('[INFO] Executing TinyTeX installation script. This may take a few minutes...');
    try {
        const { stdout, stderr } = await execAsync(`sh ${installScriptPath}`);
        console.log(stdout);
        if (stderr) console.error(stderr);
        fs.unlinkSync(installScriptPath); // Clean up script
        console.log('[SUCCESS] TinyTeX installation completed successfully.');
    } catch (error) {
        fs.unlinkSync(installScriptPath); // Clean up script
        console.error('[ERROR] TinyTeX installation failed.', error);
        throw error;
    }
}


export async function setupLatexCompiler(): Promise<void> {
    console.log('[INFO] Checking for LaTeX compiler...');
    if (await commandExists('pdflatex')) {
        console.log('[SUCCESS] Found system-wide pdflatex installation.');
        return;
    }
    
    if (fs.existsSync(TINYTEX_PDFLATEX)) {
         console.log('[SUCCESS] Found local TinyTeX installation.');
         return;
    }

    console.warn('[WARN] No LaTeX compiler (pdflatex) found in your system PATH.');
    const answer = await question('[PROMPT] Would you like to automatically download and install a local version (TinyTeX)? (y/N): ');

    if (answer.toLowerCase() === 'y') {
        await installTinyTeX();
    } else {
        console.error('[ERROR] Cannot proceed without a LaTeX compiler. Please install one manually (like TeX Live, MiKTeX) and ensure `pdflatex` is in your PATH.');
        (process as any).exit(1);
    }
}


export async function compileLatex(texPath: string): Promise<string> {
    const outputDir = path.dirname(texPath);
    const jobName = path.basename(texPath, '.tex');
    const pdfPath = path.join(outputDir, `${jobName}.pdf`);
    
    let pdflatexCmd = 'pdflatex';
    if(fs.existsSync(TINYTEX_PDFLATEX) && !(await commandExists('pdflatex'))){
        pdflatexCmd = TINYTEX_PDFLATEX;
    }

    const command = `${pdflatexCmd} -interaction=nonstopmode -jobname="${jobName}" -output-directory="${outputDir}" "${texPath}"`;
    
    // Run twice for references, etc.
    for (let i = 0; i < 2; i++) {
        console.log(`[INFO] Running LaTeX compilation (Pass ${i + 1})...`);
        try {
            await execAsync(command);
        } catch (error) {
            console.error(`[ERROR] LaTeX compilation failed on pass ${i + 1}.`);
            const logPath = path.join(outputDir, `${jobName}.log`);
            if (fs.existsSync(logPath)) {
                const logContent = fs.readFileSync(logPath, 'utf-8');
                const errorLines = logContent.split('\n').filter(line => line.startsWith('! ')).join('\n');
                console.error("Relevant error from log:\n", errorLines || 'Could not find specific error line in log.');
            }
            throw new Error('pdflatex compilation failed.');
        }
    }

    if (!fs.existsSync(pdfPath)) {
        throw new Error('PDF file was not created after compilation.');
    }

    return pdfPath;
}