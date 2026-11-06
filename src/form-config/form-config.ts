/**
 * The feedback form's content. The server is the single source of truth:
 * it validates submissions against this and serves it to the client
 * (GET /api/form-config), which renders the form and admin views from it.
 */

export const RATING = ['Excellent', 'Very good', 'Good', 'Fair', 'Poor'] as const;
export const CONFIDENCE = ['Very confident', 'Confident', 'Somewhat confident', 'Not yet confident'] as const;

export type SectionId = 'training' | 'stablenet';

export interface FormSection {
  id: SectionId;
  title: string;
  lead: string;
}

export interface FormQuestion {
  id: string;
  section: SectionId;
  text: string;
  options: readonly string[];
  /** Short header for admin tables and charts. */
  label: string;
  /** Header for the CSV export. */
  csvLabel: string;
}

export const SECTIONS: FormSection[] = [
  { id: 'training', title: 'The training and trainers', lead: 'Tell us honestly how the week went.' },
  { id: 'stablenet', title: 'Using StableNet', lead: 'How ready do you feel to use these features on your own?' },
];

export const QUESTIONS: FormQuestion[] = [
  {
    id: 'q1',
    section: 'training',
    text: 'How would you rate the StableNet training overall?',
    options: RATING,
    label: 'Training overall',
    csvLabel: 'Training overall',
  },
  {
    id: 'q2',
    section: 'training',
    text: 'How would you rate the trainers’ knowledge of StableNet?',
    options: RATING,
    label: 'Trainers’ knowledge',
    csvLabel: 'Trainers knowledge',
  },
  {
    id: 'q3',
    section: 'training',
    text: 'How would you rate the trainers’ delivery and ability to explain concepts clearly?',
    options: RATING,
    label: 'Trainers’ delivery',
    csvLabel: 'Trainers delivery',
  },
  {
    id: 'q4',
    section: 'stablenet',
    text: 'How confident are you in creating and scheduling reports on StableNet?',
    options: CONFIDENCE,
    label: 'Reporting',
    csvLabel: 'Reporting confidence',
  },
  {
    id: 'q5',
    section: 'stablenet',
    text: 'How confident are you in tagging devices on StableNet to group them and route alerts?',
    options: CONFIDENCE,
    label: 'Tagging',
    csvLabel: 'Tagging confidence',
  },
];

export const OPCOS = [
  'MTN Cameroon',
  'MTN Nigeria',
  'MTN Ghana',
  'MTN Côte d’Ivoire',
  'MTN Uganda',
  'MTN Rwanda',
  'MTN Zambia',
  'MTN Congo-Brazzaville',
  'MTN Benin',
  'MTN Guinea-Bissau',
  'MTN Liberia',
  'MTN South Africa',
] as const;

export const CONSENT = {
  question: 'Do you consent to your name and feedback being used in the training success story?',
  disclaimer:
    'Zoracom would like to publish a short success story about this training, which may include your name, your OpCo and your feedback. Your answer here doesn’t affect your certificate.',
  options: [
    { label: 'Yes, I consent', value: 'Yes' },
    { label: 'No, I don’t consent', value: 'No' },
  ],
} as const;

export const FORM_CONFIG = {
  sections: SECTIONS,
  questions: QUESTIONS,
  opcos: OPCOS,
  defaultOpco: OPCOS[0],
  consent: CONSENT,
} as const;

export type FormConfig = typeof FORM_CONFIG;
