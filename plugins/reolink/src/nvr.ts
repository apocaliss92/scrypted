import { AdoptDevice, DeviceDiscovery, DiscoveredDevice, ScryptedDeviceBase, Setting, Settings, SettingValue } from "@scrypted/sdk";
import { StorageSettings } from '@scrypted/sdk/storage-settings';
import ReolinkProvider from "./main";

export class ReolinkNvr extends ScryptedDeviceBase implements DeviceDiscovery, Settings {
    plugin: ReolinkProvider;

    storageSettings = new StorageSettings(this, {
        address: {
            title: 'IP',
            type: 'string',
        },
        username: {
            title: 'Username',
            placeholder: 'admin',
            defaultValue: 'admin',
            type: 'string',
        },
        password: {
            title: 'Password',
            type: 'password',
        },
        port: {
            title: 'HTTP Port',
            subgroup: 'Advanced',
            defaultValue: 80,
            placeholder: '80',
            type: 'number',
        },
        rtspPort: {
            subgroup: 'Advanced',
            title: 'RTSP Port',
            placeholder: '554',
            defaultValue: 554,
            type: 'number'
        },
        abilities: {
            json: true,
            hide: true,
            defaultValue: {}
        },
        devicesData: {
            json: true,
            hide: true,
            defaultValue: {}
        },
        hubData: {
            json: true,
            hide: true,
            defaultValue: {}
        },
    });

    constructor(nativeId: string, plugin: ReolinkProvider) {
        super(nativeId);
        this.plugin = plugin;
    }

    getSettings(): Promise<Setting[]> {
        throw new Error("Method not implemented.");
    }

    putSetting(key: string, value: SettingValue): Promise<void> {
        throw new Error("Method not implemented.");
    }

    discoverDevices(scan?: boolean): Promise<DiscoveredDevice[]> {
        throw new Error('Method not implemented.');
    }

    adoptDevice(device: AdoptDevice): Promise<string> {
        throw new Error('Method not implemented.');
    }
}