declare module 'html5-qrcode-removed' {
  export interface Html5QrcodeResult {
    text: string
    format: string
  }

  export interface Html5QrcodeCameraScanConfig {
    fps?: number
    qrbox?: { width: number; height: number } | number
    aspectRatio?: number
    disableFlip?: boolean
    videoConstraints?: MediaTrackConstraints
  }

  export interface Html5QrcodeCameraConfig {
    facingMode?: 'environment' | 'user'
    deviceId?: string
  }

  export type QrcodeSuccessCallback = (decodedText: string, result: Html5QrcodeResult) => void
  export type QrcodeErrorCallback = (errorMessage: string) => void

  export class Html5Qrcode {
    constructor(elementId: string, config?: { verbose?: boolean })
    start(
      cameraConfig: Html5QrcodeCameraConfig | string,
      scanConfig: Html5QrcodeCameraScanConfig,
      successCallback: QrcodeSuccessCallback,
      errorCallback?: QrcodeErrorCallback
    ): Promise<void>
    stop(): Promise<void>
    pause(): void
    resume(): void
    isScanning: boolean
    clear(): Promise<void>
  }
}
