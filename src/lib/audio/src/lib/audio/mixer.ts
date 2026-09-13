export interface MixerOutputs {
  monitor: AudioNode;
  recorder: MediaStreamAudioDestinationNode;
}

export class MasterMixer {
  readonly backingBus: GainNode;
  readonly whistleBus: GainNode;
  readonly masterBus: GainNode;
  readonly monitorBus: GainNode;
  readonly recorderOutput: MediaStreamAudioDestinationNode;

  constructor(private readonly context: AudioContext) {
    this.backingBus = context.createGain();
    this.whistleBus = context.createGain();

    this.masterBus = context.createGain();
    this.monitorBus = context.createGain();
    this.monitorBus.gain.value = 0; // Starts Bluetooth safe (OFF)


    this.recorderOutput = context.createMediaStreamDestination();

    this.backingBus.connect(this.masterBus);
    this.whistleBus.connect(this.masterBus);

    // Digital recording path — independent of monitoring.
    this.masterBus.connect(this.recorderOutput);

    // Optional headphone/speaker monitoring path.
    this.masterBus.connect(this.monitorBus);
    this.monitorBus.connect(context.destination);
  }

  connectBacking(source: AudioNode): void {
    source.connect(this.backingBus);
  }

  connectWhistle(source: AudioNode): void {
    source.connect(this.whistleBus);
  }

  setBackingGain(value: number): void {
    this.backingBus.gain.value = value;
  }

  setWhistleGain(value: number): void {
    this.whistleBus.gain.value = value;
  }

  setMasterGain(value: number): void {
    this.masterBus.gain.value = value;
  }

  setMonitorEnabled(enabled: boolean): void {
    this.monitorBus.gain.value = enabled ? 1 : 0;
  }

  get recordingStream(): MediaStream {
    return this.recorderOutput.stream;
  }

  disconnect(): void {
    this.backingBus.disconnect();
    this.whistleBus.disconnect();
    this.masterBus.disconnect();
    this.monitorBus.disconnect();
  }
}
