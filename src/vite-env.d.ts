/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ROBOT_MOCK_MODE?: string;
  readonly VITE_ROBOT_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
