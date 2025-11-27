import { DeviceCreatorSettings, DeviceInformation, ScryptedInterface, Setting } from "@scrypted/sdk";
import { RtspProvider } from "../../rtsp/src/rtsp";
import { DevInfo } from './probe';
import { ReolinkCameraClient } from './reolink-api';
import { ReolinkCamera } from "./camera";
import { ReolinkNvr } from "./nvr";

class ReolinkProvider extends RtspProvider {
    getScryptedDeviceCreator(): string {
        return 'Reolink Camera';
    }

    getAdditionalInterfaces() {
        return [
            ScryptedInterface.Reboot,
            ScryptedInterface.VideoCameraConfiguration,
            ScryptedInterface.Camera,
            ScryptedInterface.AudioSensor,
            ScryptedInterface.MotionSensor,
            ScryptedInterface.VideoTextOverlays,
        ];
    }

    async createDevice(settings: DeviceCreatorSettings, nativeId?: string): Promise<string> {
        const httpAddress = `${settings.ip}:${settings.httpPort || 80}`;
        let info: DeviceInformation = {};

        const skipValidate = settings.skipValidate?.toString() === 'true';
        const isNvr = settings.isNvr?.toString() === 'true';
        const username = settings.username?.toString();
        const password = settings.password?.toString();
        const ip = settings.ip?.toString();
        const httpPort = settings.httpPort?.toString();

        if (isNvr) {
            const device = await this.getDevice(nativeId) as ReolinkNvr;
            device.info = info;
            await device.putSetting('username', username);
            await device.putSetting('password', password);
            await device.putSetting('address', ip);
            await device.putSetting('port', httpPort);
        } else {
            let doorbell: boolean = false;
            let name: string = 'Reolink Camera';
            let deviceInfo: DevInfo;
            let ai;
            let abilities;
            const rtspChannel = parseInt(settings.rtspChannel?.toString()) || 0;
            if (!skipValidate) {
                const api = new ReolinkCameraClient(httpAddress, username, password, rtspChannel, this.console);
                const apiWithToken = new ReolinkCameraClient(httpAddress, username, password, rtspChannel, this.console, true);
                try {
                    await api.jpegSnapshot();
                }
                catch (e) {
                    this.console.error('Error adding Reolink camera', e);
                    throw e;
                }

                if (encodeURIComponent(password) !== password) {
                    throw new Error('fix your password');
                }

                try {
                    deviceInfo = await api.getDeviceInfo();
                    doorbell = deviceInfo.type === 'BELL';
                    name = deviceInfo.name ?? 'Reolink Camera';
                    ai = await api.getAiState();
                    try {
                        abilities = await api.getAbility();
                    } catch (e) {
                        abilities = await apiWithToken.getAbility();
                    }
                }
                catch (e) {
                    this.console.error('Reolink camera does not support AI events', e);
                }
            }
            settings.newCamera ||= name;

            nativeId = await super.createDevice(settings, nativeId);

            const device = await this.getDevice(nativeId) as ReolinkCamera;
            device.info = info;
            device.putSetting('username', username);
            device.putSetting('password', password);
            device.storageSettings.values.doorbell = doorbell;
            device.storageSettings.values.deviceInfo = deviceInfo;
            device.storageSettings.values.abilities = abilities;
            device.storageSettings.values.hasObjectDetector = ai;
            device.setIPAddress(ip);
            device.putSetting('rtspChannel', settings.rtspChannel?.toString());
            device.setHttpPortOverride(httpPort);
            device.updateDeviceInfo();

            return nativeId;
        }
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
                key: 'isNVR',
                title: 'Is NVR',
                description: 'Add the device as NVR Hub, allow discovering of all the devices automatically',
                type: 'boolean',
            },
            {
                subgroup: 'Advanced',
                key: 'rtspChannel',
                title: 'Channel Number Override',
                description: "Optional: The channel number to use for snapshots and video. E.g., 0, 1, 2, etc.",
                placeholder: '0',
                type: 'number',
            },
            {
                subgroup: 'Advanced',
                key: 'httpPort',
                title: 'HTTP Port',
                description: 'Optional: Override the HTTP Port from the default value of 80.',
                placeholder: '80',
            },
            {
                subgroup: 'Advanced',
                key: 'skipValidate',
                title: 'Skip Validation',
                description: 'Add the device without verifying the credentials and network settings.',
                type: 'boolean',
            }
        ]
    }

    createCamera(nativeId: string) {
        return new ReolinkCamera(nativeId, this);
    }
}

export default ReolinkProvider;
