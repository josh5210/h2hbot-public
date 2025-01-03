// /src/lib/constants/chat.ts
export const CHAT_CONSTANTS = {
  MESSAGE_LENGTH: {
    MAX: 1500,
    WARNING_THRESHOLD: 100,
  },
  TYPING_SPEED: {
    CHARS_PER_FRAME: 4,  // How many characters to add per frame
    TARGET_FPS: 60       // Target frame rate
  }
} as const;