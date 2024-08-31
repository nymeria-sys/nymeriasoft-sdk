export const AUTHORIZED_HTML = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authorization Successful</title>
    <style>
      body {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background-color: #f0f8ff;
        margin: 0;
        font-family: Arial, sans-serif;
      }
      .container {
        text-align: center;
        background: white;
        padding: 40px;
        border-radius: 10px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      }
      .icon {
        font-size: 50px;
        color: #4CAF50;
      }
      h1 {
        font-size: 2.5em;
        margin: 10px 0;
        color: #333;
      }
      p {
        font-size: 1.2em;
        color: #666;
      }
      .button {
        display: inline-block;
        margin-top: 20px;
        padding: 10px 20px;
        font-size: 1em;
        color: white;
        background-color: #4CAF50;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        text-decoration: none;
        transition: background-color 0.3s;
      }
      .button:hover {
        background-color: #45a049;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="icon">✅</div>
      <h1>Access Granted!</h1>
      <p>Your authorization was successful. Welcome aboard!</p>
      <p>You can close this window!</p>
    </div>
  </body>
  </html>`;
