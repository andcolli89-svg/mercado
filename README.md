# CbOfertas V6.0.0 Alpha 2 — reconstrução Android limpa

Esta entrega substitui integralmente o módulo Android da Alpha 1. O backend V6 foi preservado porque os testes de produto, preço, redirecionamento e Radar já passam.

## O que mudou

- Projeto Android recriado com uma combinação estável e fechada de versões.
- Removidas todas as configurações do AGP 9, API 36/37 e Kotlin integrado que provocaram erros em sequência.
- Interface Compose reescrita sem reutilizar o arquivo `App.kt` problemático.
- Novo `applicationId` de teste, permitindo instalar a V6 ao lado da V5.
- Estado de busca sempre limpo antes de uma consulta.
- Preço atual, original, parcela, cashback e preço por unidade exibidos separadamente.
- Biblioteca de afiliados, Radar, histórico, favoritos, tema e compartilhamento mantidos na nova base.
- Backend configurável pela tela Ajustes.

## Toolchain Android congelada

- Android Gradle Plugin 8.7.3
- Gradle 8.9
- Kotlin e Compose Compiler 2.0.21
- compileSdk e targetSdk 35
- Core KTX 1.15.0
- Activity Compose 1.10.0
- Compose BOM 2024.12.01
- JDK 17

## Branch e produção

Use somente a branch `v6-rebuild`. Não faça merge na `main` e não substitua o backend V5.

O APK Alpha usa o identificador `com.cbofertas.v6.alpha.debug` e pode coexistir com a CbOfertas V5.

## Backend V6

```bash
cd backend
npm run validate
npm test
npm start
```

Crie um serviço Render separado apontando para a branch `v6-rebuild` e para a pasta `backend`. Depois informe o endereço HTTPS desse serviço na tela **Ajustes** do aplicativo.

## GitHub Actions

O workflow `.github/workflows/build-v6.yml` valida o backend, instala Android API 35, executa os testes Android e gera:

- `CbOfertas-V6.0.0-alpha.2.apk`
- checksum SHA-256
- ZIP das fontes

Esta versão ainda é Alpha e não deve substituir a V5 em produção.
