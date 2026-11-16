export type IoxSlot = {
  slot_id: number | undefined;
  module_type: number | undefined;
  lock: Array<boolean | undefined>;
  sync: Array<boolean | undefined>;
};

export type IoxMadi = {
  host_lock: boolean | undefined;
  lock: boolean | undefined;
  sync: boolean | undefined;
};

export type IoxDevice = {
  serial: number | undefined;
  temperature: number | undefined;
  psu: Array<boolean | undefined>;
  slot: IoxSlot[];
  madi: IoxMadi[];
};

export type IoxLoop = {
  devices: IoxDevice[];
};
