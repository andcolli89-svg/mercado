# CbOfertas V8.0 — arquitetura modular

A V8 mantém a interface aprovada e separa as responsabilidades:

- `modules/core/event-bus.js`: comunicação entre módulos.
- `modules/core/storage.js`: acesso protegido ao armazenamento.
- `modules/core/safe-runtime.js`: isolamento e registro de erros.
- `modules/features/affiliate-module.js`: biblioteca de afiliados e compatibilidade.
- `modules/features/navigation-module.js`: navegação independente.
- `modules/features/queue-transfer-module.js`: importação/exportação normalizada.
- `modules/features/startup-module.js`: inicialização e versão.

O arquivo `app.js` permanece como camada de compatibilidade durante a migração,
mas erros isolados deixam de impedir a navegação e os demais módulos.

## Correções desta base
- `saveAffiliateLibrary is not defined`.
- FileProvider para exportação.
- Seletor de arquivos `.cbofertas`.
- Exportação para WhatsApp Business.
- Navegação independente.
- Diagnóstico persistente de erros.
