import { Hono } from '@hono/hono'
import { stream } from '@hono/hono/streaming'
import GIFEncoder from 'gifencoder'
import { createCanvas } from 'canvas';
const app = new Hono()

function nodeStreamToReadableStream(nodeStream: any) {
    return new ReadableStream({
        start(controller) {
            // Node.js Streamのデータが来るたびにキューに追加
            nodeStream.on('data', (chunk: any) => {
                controller.enqueue(chunk);
            });

            // Node.js Streamが終了したら完了を通知
            nodeStream.on('end', () => {
                controller.close();
            });

            // エラーが発生した場合はエラーを通知
            nodeStream.on('error', (err: any) => {
                controller.error(err);
            });
        },

        cancel() {
            // Web ReadableStream がキャンセルされたら Node.js ストリームも破棄
            nodeStream.destroy();
        }
    });
}

function generate(text: string): ReadableStream {
    if (text.length == 0) 
        text = '>'
    const len = text.length;
    const fontSize = 16;
    const w = 480;
    const maxChars = w / fontSize; 
    const h = ((len / maxChars) + ((len % maxChars) ? 1 : 0)) * fontSize;
    const encoder = new GIFEncoder(w, h);
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const stream = encoder.createReadStream();
    encoder.start();
    encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
    encoder.setDelay(100);  // frame delay in ms
    encoder.setQuality(10); // image quality. 10 is default.
    for (let i = 1; i < len; i++) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "lightgreen";
        ctx.font = `${fontSize}px Arial`;
        ctx.fillText(text.substring(0, i), 0, fontSize, w);
        encoder.addFrame(ctx);
    }
    for (let i = 1; i < 10; i++) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "lightgreen";
        ctx.font = `${fontSize}px Arial`;
        ctx.fillText(text, 0, fontSize, w);
        encoder.addFrame(ctx);
    }
    encoder.finish();
    return nodeStreamToReadableStream(stream);
}

app.get('/', (c) => {
    return stream(c, async (stream) => {
        const text = c.req.query('text') as string
        c.header('Content-Type', 'image/gif')
        // Write a process to be executed when aborted.
        stream.onAbort(() => {
          console.log('Aborted!')
        })
        // Pipe a readable stream.
        await stream.pipe(generate(text ?? '> You should set "text" query parameter.'))
    })
})

Deno.serve(app.fetch)