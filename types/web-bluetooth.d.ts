// Minimal Web Bluetooth API type declarations
// Full spec: https://webbluetoothcg.github.io/web-bluetooth/

interface BluetoothRemoteGATTCharacteristic {
  writeValue(value: BufferSource): Promise<void>
  readValue(): Promise<DataView>
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTServer {
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
}

interface BluetoothDevice extends EventTarget {
  name?: string
  gatt?: BluetoothRemoteGATTServer
  addEventListener(type: 'gattserverdisconnected', listener: (event: Event) => void): void
  removeEventListener(type: 'gattserverdisconnected', listener: (event: Event) => void): void
}

interface RequestDeviceOptions {
  filters?: Array<{
    name?: string
    namePrefix?: string
    services?: string[]
  }>
  optionalServices?: string[]
  acceptAllDevices?: boolean
}

interface Bluetooth {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>
  getAvailability(): Promise<boolean>
}

interface Navigator {
  bluetooth: Bluetooth
}
