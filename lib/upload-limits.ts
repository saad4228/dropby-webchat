import { IMAGE_TYPES, UPLOAD_LIMITS, mediaSignature } from "./media-config.ts";
export const MAX_FILE_BYTES = UPLOAD_LIMITS.video;
export const MAX_IMAGE_BYTES = UPLOAD_LIMITS.logo;
export const IMAGE_MIMES = IMAGE_TYPES;
export const imageSignatureMatches = mediaSignature;
