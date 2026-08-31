# Firmware (ESP32)

Reads MAX30102 (SpO2/pulse) and MLX90614 (IR temperature) over I2C, then
POSTs JSON readings to the backend over WiFi:

```
POST http://<backend-host>:8787/api/consultations/<consultation_id>/vitals
Content-Type: application/json

{ "type": "spo2" | "pulse" | "temp", "value": 0, "unit": "%|bpm|C", "source": "device" }
```

Send one POST per reading per sensor. `consultation_id` is shown on the
active consultation page in the web app — for the MVP, whoever starts the
device just reads it off the screen; the token-based pairing flow (device
claims itself, gets assigned to a hospital/room, authenticates every
request) is the documented next step in [../PROJECT_PLAN.md](../PROJECT_PLAN.md), not needed for a single-device demo.

Build in the Arduino IDE. Start from each sensor library's example sketch
(SparkFun's MAX3010x library for the MAX30102, Adafruit's MLX90614 library)
and add the WiFi POST call using `HTTPClient`.

