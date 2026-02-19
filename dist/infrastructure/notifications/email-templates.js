"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProcessingFailedEmail = buildProcessingFailedEmail;
exports.buildProcessingCompletedEmail = buildProcessingCompletedEmail;
function buildProcessingFailedEmail(data) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #dc3545; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
    .error-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
    .footer { margin-top: 20px; font-size: 12px; color: #6c757d; text-align: center; }
    .detail { margin: 10px 0; }
    .label { font-weight: bold; color: #495057; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Falha no Processamento de Vídeo</h1>
    </div>
    <div class="content">
      <p>Olá <strong>${data.personName}</strong>,</p>

      <p>Infelizmente não conseguimos processar seu vídeo após ${data.attemptCount} tentativas.</p>

      <div class="error-box">
        <p class="label">Detalhes do Erro:</p>
        <p>${data.error}</p>
      </div>

      <div class="detail">
        <span class="label">ID do Vídeo:</span> ${data.videoId}
      </div>

      <div class="detail">
        <span class="label">Nome do Arquivo:</span> ${data.fileName}
      </div>

      <div class="detail">
        <span class="label">Tentativas Realizadas:</span> ${data.attemptCount}
      </div>

      <p style="margin-top: 20px;">
        <strong>O que fazer agora?</strong>
      </p>
      <ul>
        <li>Verifique se o arquivo de vídeo está corrompido</li>
        <li>Certifique-se de que o formato é suportado (MP4, AVI, MOV)</li>
        <li>Tente fazer upload novamente com um arquivo diferente</li>
        <li>Entre em contato com o suporte se o problema persistir</li>
      </ul>

      <p>Atenciosamente,<br>
      <strong>Equipe FIAP X</strong></p>
    </div>
    <div class="footer">
      <p>Este é um e-mail automático. Por favor, não responda.</p>
      <p>Sistema de Processamento de Vídeos - FIAP X</p>
    </div>
  </div>
</body>
</html>
  `.trim();
    const text = `
Falha no Processamento de Vídeo

Olá ${data.personName},

Infelizmente não conseguimos processar seu vídeo após ${data.attemptCount} tentativas.

Detalhes:
- ID do Vídeo: ${data.videoId}
- Nome do Arquivo: ${data.fileName}
- Tentativas: ${data.attemptCount}
- Erro: ${data.error}

O que fazer agora?
- Verifique se o arquivo de vídeo está corrompido
- Certifique-se de que o formato é suportado (MP4, AVI, MOV)
- Tente fazer upload novamente com um arquivo diferente
- Entre em contato com o suporte se o problema persistir

Atenciosamente,
Equipe FIAP X

---
Este é um e-mail automático. Por favor, não responda.
  `.trim();
    return { html, text };
}
function buildProcessingCompletedEmail(data) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #28a745; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
    .success-box { background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0; }
    .footer { margin-top: 20px; font-size: 12px; color: #6c757d; text-align: center; }
    .detail { margin: 10px 0; }
    .label { font-weight: bold; color: #495057; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Vídeo Processado com Sucesso!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>${data.personName}</strong>,</p>

      <p>Ótimas notícias! Seu vídeo foi processado com sucesso.</p>

      <div class="success-box">
        <p class="label">✨ Processamento Concluído</p>
        <p>Extraímos <strong>${data.framesExtracted} frames</strong> do seu vídeo em apenas <strong>${data.processingTime}</strong>.</p>
      </div>

      <div class="detail">
        <span class="label">ID do Vídeo:</span> ${data.videoId}
      </div>

      <div class="detail">
        <span class="label">Nome do Arquivo:</span> ${data.fileName}
      </div>

      <div class="detail">
        <span class="label">Frames Extraídos:</span> ${data.framesExtracted}
      </div>

      <div class="detail">
        <span class="label">Tempo de Processamento:</span> ${data.processingTime}
      </div>

      <p style="margin-top: 20px;">
        Seus frames estão disponíveis para download através da plataforma.
      </p>

      <p>Atenciosamente,<br>
      <strong>Equipe FIAP X</strong></p>
    </div>
    <div class="footer">
      <p>Este é um e-mail automático. Por favor, não responda.</p>
      <p>Sistema de Processamento de Vídeos - FIAP X</p>
    </div>
  </div>
</body>
</html>
  `.trim();
    const text = `
Vídeo Processado com Sucesso!

Olá ${data.personName},

Ótimas notícias! Seu vídeo foi processado com sucesso.

Detalhes:
- ID do Vídeo: ${data.videoId}
- Nome do Arquivo: ${data.fileName}
- Frames Extraídos: ${data.framesExtracted}
- Tempo de Processamento: ${data.processingTime}

Seus frames estão disponíveis para download através da plataforma.

Atenciosamente,
Equipe FIAP X

---
Este é um e-mail automático. Por favor, não responda.
  `.trim();
    return { html, text };
}
//# sourceMappingURL=email-templates.js.map