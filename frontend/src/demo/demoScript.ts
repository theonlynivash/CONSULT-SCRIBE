export const demoConversation: { speaker: 'doctor' | 'patient'; text: string }[] = [
  { speaker: 'doctor', text: "Good morning, what's brought you in today?" },
  { speaker: 'patient', text: "I've had a fever and a dry cough for the past three days, and I feel really tired." },
  { speaker: 'doctor', text: 'Any shortness of breath or chest pain?' },
  { speaker: 'patient', text: 'A little short of breath when I climb stairs, no chest pain.' },
  { speaker: 'doctor', text: 'Any known allergies or medications you take regularly?' },
  { speaker: 'patient', text: 'No allergies, I just take a multivitamin.' },
];

export const demoVitals: { type: 'spo2' | 'pulse' | 'temp'; value: number; unit: string }[] = [
  { type: 'temp', value: 38.4, unit: '°C' },
  { type: 'spo2', value: 94, unit: '%' },
  { type: 'pulse', value: 96, unit: 'bpm' },
];
