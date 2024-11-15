import { sleep } from '@scrypted/common/src/sleep';
import sdk, { Brightness, Camera, Device, DeviceCreatorSettings, DeviceInformation, DeviceProvider, Intercom, MediaObject, ObjectDetectionTypes, ObjectDetector, ObjectsDetected, OnOff, PanTiltZoom, PanTiltZoomCommand, Reboot, RequestPictureOptions, ScryptedDeviceBase, ScryptedDeviceType, ScryptedInterface, Setting, Settings } from "@scrypted/sdk";
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import { EventEmitter } from "stream";
import { createRtspMediaStreamOptions, Destroyable, RtspProvider, RtspSmartCamera, UrlMediaStreamOptions } from "../../rtsp/src/rtsp";
import MqttClient from './mqtt-client';
import NeolinkCamera from './camera';

// class NeolinkCameraSiren extends ScryptedDeviceBase implements OnOff {
//     sirenTimeout: NodeJS.Timeout;

//     constructor(public camera: ReolinkCamera, nativeId: string) {
//         super(nativeId);
//         this.on = false;
//     }

//     async turnOff() {
//         this.on = false;
//         await this.setSiren(false);
//     }

//     async turnOn() {
//         this.on = true;
//         await this.setSiren(true);
//     }

//     private async setSiren(on: boolean) {
//         const api = this.camera.getClient();

//         // doorbell doesn't seem to support alarm_mode = 'manul'
//         if (this.camera.storageSettings.values.doorbell) {
//             if (!on) {
//                 clearInterval(this.sirenTimeout);
//                 await api.setSiren(false);
//                 return;
//             }

//             // siren lasts around 4 seconds.
//             this.sirenTimeout = setTimeout(async () => {
//                 await this.turnOff();
//             }, 4000);

//             await api.setSiren(true, 1);
//             return;
//         }
//         await api.setSiren(on);
//     }
// }

// class NeolinkCameraFloodlight extends ScryptedDeviceBase implements OnOff, Brightness {
//     constructor(public camera: ReolinkCamera, nativeId: string) {
//         super(nativeId);
//         this.on = false;
//     }

//     async setBrightness(brightness: number): Promise<void> {
//         this.brightness = brightness;
//         await this.setFloodlight(undefined, brightness);
//     }

//     async turnOff() {
//         this.on = false;
//         await this.setFloodlight(false);
//     }

//     async turnOn() {
//         this.on = true;
//         await this.setFloodlight(true);
//     }

//     private async setFloodlight(on?: boolean, brightness?: number) {
//         const api = this.camera.getClientWithToken();

//         await api.setWhiteLedState(on, brightness);
//     }
// }

class NeolinkProvider extends RtspProvider {
    getScryptedDeviceCreator(): string {
        return 'Neolink Camera';
    }

    getAdditionalInterfaces() {
        return [
            ScryptedInterface.VideoCameraConfiguration,
            ScryptedInterface.Camera,
            ScryptedInterface.MotionSensor,
        ];
    }

    async createDevice(settings: DeviceCreatorSettings, nativeId?: string): Promise<string> {
        const username = settings.username?.toString();
        const password = settings.password?.toString();
        const cameraName = settings.cameraName?.toString();
        const rtspPort = settings.rtspPort?.toString() ?? '8554';
        const ip = settings.ip?.toString();

        if (!cameraName || !ip) {
            this.console.log('Camera name and IP are required');
            return;
        }
        settings.newCamera = cameraName.toString().match(/[A-Z][a-z]+/g).join(' ');
        nativeId = await super.createDevice(settings, nativeId);

        const device = await this.getDevice(nativeId) as NeolinkCamera;
        device.putSetting('username', username);
        device.putSetting('password', password);
        device.putSetting('rtspPort', rtspPort);
        device.putSetting('cameraName', cameraName);
        device.setIPAddress(ip?.toString());

        return nativeId;
    }

    async getCreateDeviceSettings(): Promise<Setting[]> {
        return [
            {
                key: 'username',
                title: 'Username',
            },
            {
                key: 'password',
                title: 'Password',
                type: 'password',
            },
            {
                key: 'ip',
                title: 'IP Address',
                placeholder: '192.168.2.222',
            },
            {
                key: 'rtspPort',
                title: 'RTSP Port Override',
                placeholder: '8554',
            },
            {
                key: 'cameraName',
                title: 'Camera neolink name',
                type: 'string',
            }
        ]
    }

    createCamera(nativeId: string) {
        return new NeolinkCamera(nativeId, this);
    }
}

export default NeolinkProvider;
