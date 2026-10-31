// Write Outreach - Recommendation Service
// =======================================
// Responsible for selecting the more suitable channel for generated copy.
// Considers: message length, communication style, clarity, personalization,
// suitability for the channel, strength of the CTA.
// Does not invent measured conversion probabilities.

import {
  Channel,
  Tone,
  EmailContent,
  LinkedInContent,
} from './types';

/** Maps a channel to its target word count range */
function getTargetWordCount(channel: Channel): { min: number; max: number } {
  if (channel === Channel.Email) return { min: 100, max: 160 };
  return { min: 50, max: 100 };
}

/**
 * Recommend the more suitable channel for the given copy.
 * 
 * @param emailContent The generated email body text
 * @param linkedinContent The generated LinkedIn message text
 * @param prospectContext Object with leadName, company, role
 * @param requestedTone The selected tone as a string (e.g. "Professional & Direct")
 * @returns The recommended channel ('email' or 'linkedin')
 */
export async function recommendChannel(
  emailContent: string,
  linkedinContent: string,
  prospectContext: { leadName: string; company: string; role: string },
  requestedTone: string,
): Promise<Channel> {
  const tone = requestedTone.toLowerCase().replace(/\s+/g, '');

  const { leadName, company, role } = prospectContext;

  // Analyze email content length vs target
  const emailTarget = getTargetWordCount(Channel.Email);
  const emailWordCount = emailContent.split(/\s+/).length;
  const emailLengthScore = analyzeLengthScore(emailWordCount, emailTarget.min, emailTarget.max);

  // Analyze LinkedIn content length vs target
  const linkedinTarget = getTargetWordCount(Channel.LinkedIn);
  const linkedinWordCount = linkedinContent.split(/\s+/).length;
  const linkedinLengthScore = analyzeLengthScore(linkedinWordCount, linkedinTarget.min, linkedinTarget.max);

  // Analyze CTA strength (simple heuristic: presence of natural CTA phrases)
  const emailCtaScore = analyzeCtaStrength(emailContent);
  const linkedinCtaScore = analyzeCtaStrength(linkedinContent);

  // Analyze personalization quality (presence of prospect details)
  const personalizationScore = analyzePersonalization(
    emailContent + ' ' + linkedinContent,
    leadName,
    company,
    role
  );

  // Channel suitability factors
  // Email is better for: longer, detailed messages, formal tones, complex value props
  // LinkedIn is better for: shorter, concise messages, conversational tones, quick CTAs

  const scores: Record<Channel, number> = {
    [Channel.Email]: 0,
    [Channel.LinkedIn]: 0,
  };

  // Length appropriateness (30% weight)
  scores[Channel.Email] += emailLengthScore * 0.3;
  scores[Channel.LinkedIn] += linkedinLengthScore * 0.3;

  // CTA strength (30% weight)
  scores[Channel.Email] += emailCtaScore * 0.3;
  scores[Channel.LinkedIn] += linkedinCtaScore * 0.3;

  // Personalization (20% weight)
  scores[Channel.Email] += personalizationScore * 0.2;
  scores[Channel.LinkedIn] += personalizationScore * 0.2;

  // Tone-channel fit (20% weight)
  // Map tone to fit scores - use lowercase no-space version for matching
  const toneFit: Record<string, Record<Channel, number>> = {
    'professionaldirect': {
      [Channel.Email]: 1.0,
      [Channel.LinkedIn]: 0.8,
    },
    'friendlyandconversational': {
      [Channel.Email]: 0.8,
      [Channel.LinkedIn]: 1.0,
    },
    'persuasiveandconfident': {
      [Channel.Email]: 1.0,
      [Channel.LinkedIn]: 0.9,
    },
    consultative: {
      [Channel.Email]: 0.9,
      [Channel.LinkedIn]: 0.85,
    },
    'warmandpersonal': {
      [Channel.Email]: 0.9,
      [Channel.LinkedIn]: 1.0,
    },
    formal: {
      [Channel.Email]: 1.0,
      [Channel.LinkedIn]: 0.7,
    },
  };

  const fit = toneFit[tone] || {
    [Channel.Email]: 0.5,
    [Channel.LinkedIn]: 0.5,
  };

  scores[Channel.Email] += fit[Channel.Email] * 0.2;
  scores[Channel.LinkedIn] += fit[Channel.LinkedIn] * 0.2;

  // Select the channel with the higher score
  // In case of tie, default to email
  if (scores[Channel.Email] >= scores[Channel.LinkedIn]) {
    return Channel.Email;
  }
  return Channel.LinkedIn;
}

/** Analyzes if the word count is appropriate for the channel */
function analyzeLengthScore(
  wordCount: number,
  min: number,
  max: number
): number {
  if (wordCount >= min && wordCount <= max) return 1.0;
  if (wordCount < min) return wordCount / Math.max(min, 1);
  return Math.max(0, 1 - (wordCount - max) / 50); // penalize overshoot
}

/** Analyzes CTA strength based on presence of natural CTA phrases */
function analyzeCtaStrength(content: string): number {
  const lower = content.toLowerCase();
  const ctaPhrases = [
    'reply', 'connect', 'learn more', 'schedule', 'demo', 'call', 'discuss',
    'convenient time', 'your thoughts', 'interested',
  ];

  const foundCtaPhrases = ctaPhrases.filter(phrase => lower.includes(phrase));
  // Normalized score: 1.0 if at least one CTA phrase found, decay based on count
  const maxPossible = Math.min(foundCtaPhrases.length, 3) / 3;
  return maxPossible;
}

/** Analyzes personalization quality in the content */
function analyzePersonalization(
  content: string,
  leadName: string,
  company: string,
  role: string
): number {
  const lower = content.toLowerCase();
  const scoreComponents: number[] = [];

  // Check for name mention
  if (lower.includes(leadName.toLowerCase())) scoreComponents.push(1.0);
  else scoreComponents.push(0.5); // partial if salutation only

  // Check for company mention
  if (lower.includes(company.toLowerCase())) scoreComponents.push(1.0);
  else scoreComponents.push(0);

  // Check for role/title mention
  if (lower.includes(role.toLowerCase())) scoreComponents.push(1.0);
  else scoreComponents.push(0);

  const average = scoreComponents.reduce((a, b) => a + b, 0) / scoreComponents.length;
  return Math.max(0, Math.min(1, average));
}

/** Computes tone-channel fit score */
function computeToneChannelFit(tone: Tone, channel: Channel): number {
  // Some tones fit better with certain channels
  const toneFit: Record<string, Record<Channel, number>> = {
    'professionaldirect': {
      [Channel.Email]: 1.0,
      [Channel.LinkedIn]: 0.8,
    },
    'friendlyandconversational': {
      [Channel.Email]: 0.8,
      [Channel.LinkedIn]: 1.0,
    },
    'persuasiveandconfident': {
      [Channel.Email]: 1.0,
      [Channel.LinkedIn]: 0.9,
    },
    consultative: {
      [Channel.Email]: 0.9,
      [Channel.LinkedIn]: 0.85,
    },
    'warmandpersonal': {
      [Channel.Email]: 0.9,
      [Channel.LinkedIn]: 1.0,
    },
    formal: {
      [Channel.Email]: 1.0,
      [Channel.LinkedIn]: 0.7,
    },
  };

  return toneFit[tone]?.[channel] || 0.5;
}