// Patient-side microphone unit — Consult Scribe
//
// Hardware: ESP32 (S3 recommended for extra RAM) + INMP441 I2S microphone
// + a push button. Physically sits on the patient's side, separate from
// the doctor's laptop, so speaker identification is automatic: whatever
// this device hears is the patient, full stop — no diarization needed.
//
// Flow: hold the button to record, release to stop and upload. The clip
// is wrapped in a WAV header in RAM and POSTed as one HTTP request to the
// backend's /audio endpoint, which transcribes it and files it as a
// patient transcript line automatically.
//
// NOT tested on physical hardware in this session (no device available)
// — the I2S config, WAV header, and HTTP POST follow standard, widely
// used patterns for INMP441 + ESP32, but double-check wiring/pins and
// sample behavior against your specific board before a live demo.
//
// Wiring (INMP441 -> ESP32):
//   VDD -> 3.3V   GND -> GND   L/R -> GND (left channel)
//   WS  -> GPIO 15   SCK -> GPIO 14   SD -> GPIO 32
// Push button: one leg -> GPIO 4, other leg -> GND (uses internal pull-up)

#include <WiFi.h>
#include <HTTPClient.h>
#include <driver/i2s.h>

// ---- Configure for your setup ----
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BACKEND_HOST = "192.168.1.100"; // your backend machine's LAN IP
const int BACKEND_PORT = 8787;
const char* CONSULTATION_ID = "PASTE_ACTIVE_CONSULTATION_ID_HERE";
// -----------------------------------

#define I2S_WS_PIN 15
#define I2S_SCK_PIN 14
#define I2S_SD_PIN 32
#define BUTTON_PIN 4

const uint32_t SAMPLE_RATE = 16000;      // 16kHz mono is plenty for speech STT
const int MAX_RECORD_SECONDS = 20;       // caps buffer size in RAM
const size_t MAX_SAMPLES = SAMPLE_RATE * MAX_RECORD_SECONDS;

int16_t* audioBuffer;
size_t sampleCount = 0;

void setupI2S() {
  i2s_config_t config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 256,
    .use_apll = false,
  };
  i2s_pin_config_t pins = {
    .bck_io_num = I2S_SCK_PIN,
    .ws_io_num = I2S_WS_PIN,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD_PIN,
  };
  i2s_driver_install(I2S_NUM_0, &config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pins);
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  audioBuffer = (int16_t*)malloc(MAX_SAMPLES * sizeof(int16_t));
  if (!audioBuffer) {
    Serial.println("Failed to allocate audio buffer — try an ESP32-S3 with PSRAM.");
  }

  setupI2S();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nConnected: " + WiFi.localIP().toString());
}

bool wasPressed = false;

void loop() {
  bool pressed = digitalRead(BUTTON_PIN) == LOW;

  if (pressed && !wasPressed) {
    // Button just pressed — start a fresh recording.
    sampleCount = 0;
    Serial.println("Recording...");
  }

  if (pressed) {
    size_t bytesRead = 0;
    int16_t chunk[256];
    i2s_read(I2S_NUM_0, chunk, sizeof(chunk), &bytesRead, portMAX_DELAY);
    size_t samplesRead = bytesRead / sizeof(int16_t);
    if (sampleCount + samplesRead < MAX_SAMPLES) {
      memcpy(audioBuffer + sampleCount, chunk, bytesRead);
      sampleCount += samplesRead;
    }
  }

  if (!pressed && wasPressed) {
    // Button just released — send what we captured.
    Serial.printf("Captured %u samples, uploading...\n", (unsigned)sampleCount);
    uploadRecording();
  }

  wasPressed = pressed;
  delay(5);
}

// Builds a standard 44-byte WAV header for 16-bit mono PCM at SAMPLE_RATE.
void writeWavHeader(uint8_t* header, size_t dataBytes) {
  uint32_t byteRate = SAMPLE_RATE * 2;
  uint32_t chunkSize = 36 + dataBytes;

  memcpy(header, "RIFF", 4);
  memcpy(header + 4, &chunkSize, 4);
  memcpy(header + 8, "WAVEfmt ", 8);
  uint32_t subchunk1Size = 16;
  uint16_t audioFormat = 1; // PCM
  uint16_t numChannels = 1;
  uint16_t blockAlign = 2;
  uint16_t bitsPerSample = 16;
  memcpy(header + 16, &subchunk1Size, 4);
  memcpy(header + 20, &audioFormat, 2);
  memcpy(header + 22, &numChannels, 2);
  memcpy(header + 24, &SAMPLE_RATE, 4);
  memcpy(header + 28, &byteRate, 4);
  memcpy(header + 32, &blockAlign, 2);
  memcpy(header + 34, &bitsPerSample, 2);
  memcpy(header + 36, "data", 4);
  memcpy(header + 40, &dataBytes, 4);
}

void uploadRecording() {
  if (sampleCount == 0) return;

  size_t dataBytes = sampleCount * sizeof(int16_t);
  size_t totalBytes = 44 + dataBytes;
  uint8_t* wav = (uint8_t*)malloc(totalBytes);
  if (!wav) {
    Serial.println("Failed to allocate WAV upload buffer.");
    return;
  }
  writeWavHeader(wav, dataBytes);
  memcpy(wav + 44, audioBuffer, dataBytes);

  HTTPClient http;
  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT +
                "/api/consultations/" + CONSULTATION_ID + "/audio?speaker=patient";
  http.begin(url);
  http.addHeader("Content-Type", "audio/wav");
  int status = http.POST(wav, totalBytes);
  Serial.printf("Upload status: %d\n", status);
  if (status > 0) Serial.println(http.getString());
  http.end();

  free(wav);
}
