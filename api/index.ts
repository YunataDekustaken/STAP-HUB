import app from "../server";

export default async (req: any, res: any) => {
  try {
    // Forward the request to the Express app
    return app(req, res);
  } catch (err: any) {
    console.error("[STAP HUB] Vercel Execution Error:", err);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; line-height: 1.6;">
          <h2 style="color: #EF4444;">Server Execution Error</h2>
          <p>The STAP Traffic Hub encountered a critical error during request execution.</p>
          <pre style="background: #F1F5F9; padding: 15px; border-radius: 8px; overflow: auto;">${err.stack || err.message}</pre>
          <p style="color: #64748B; font-size: 14px;">Please check your environment variables and logs in the Vercel dashboard.</p>
        </body>
      </html>
    `);
  }
};
