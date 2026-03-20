import { useState, useCallback } from 'react';
import { QUESTION_VALIDATION } from '@/lib/constants/question-banks';
import type { QuestionFormData } from '@/types/question-bank.types';

export interface QuestionFormInit {
  category?: string;
  useExistingCategory?: boolean;
  pointValue?: number;
  questionText?: string;
  answerText?: string;
  teacherNotes?: string;
  imageUrl?: string;
  imageAltText?: string;
  imageSizeMb?: number | null;
}

/**
 * Shared form state, validation, and payload-building logic for
 * CreateQuestionModal and EditQuestionModal.
 *
 * `initForm` and `resetForm` are stable references (useCallback with no deps)
 * so they can be safely listed in useEffect dependency arrays.
 */
export function useQuestionForm() {
  // Field state
  const [category, setCategory] = useState('');
  const [useExistingCategory, setUseExistingCategory] = useState(true);
  const [pointValue, setPointValue] = useState<number>(100);
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [teacherNotes, setTeacherNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAltText, setImageAltText] = useState('');
  const [imageSizeMb, setImageSizeMb] = useState<number | null>(null);

  // Validation error state
  const [categoryError, setCategoryError] = useState('');
  const [questionTextError, setQuestionTextError] = useState('');
  const [answerTextError, setAnswerTextError] = useState('');
  const [imageAltTextError, setImageAltTextError] = useState('');

  const clearErrors = useCallback(() => {
    setCategoryError('');
    setQuestionTextError('');
    setAnswerTextError('');
    setImageAltTextError('');
  }, []);

  /** Resets all fields and validation errors to their blank defaults. */
  const resetForm = useCallback(() => {
    setCategory('');
    setUseExistingCategory(true);
    setPointValue(100);
    setQuestionText('');
    setAnswerText('');
    setTeacherNotes('');
    setImageUrl('');
    setImageAltText('');
    setImageSizeMb(null);
    clearErrors();
  }, [clearErrors]);

  /**
   * Populates specific fields without touching the ones not provided.
   * Clears all validation errors on every call.
   * Call this inside a useEffect keyed on isOpen.
   */
  const initForm = useCallback((values: QuestionFormInit) => {
    if (values.category !== undefined) setCategory(values.category);
    if (values.useExistingCategory !== undefined) setUseExistingCategory(values.useExistingCategory);
    if (values.pointValue !== undefined) setPointValue(values.pointValue);
    if (values.questionText !== undefined) setQuestionText(values.questionText);
    if (values.answerText !== undefined) setAnswerText(values.answerText);
    if (values.teacherNotes !== undefined) setTeacherNotes(values.teacherNotes);
    if (values.imageUrl !== undefined) setImageUrl(values.imageUrl);
    if (values.imageAltText !== undefined) setImageAltText(values.imageAltText);
    if (values.imageSizeMb !== undefined) setImageSizeMb(values.imageSizeMb);
    clearErrors();
  }, [clearErrors]);

  /** Validates all fields and sets per-field error messages. Returns true if valid. */
  const validateForm = (): boolean => {
    let isValid = true;

    if (!category.trim()) {
      setCategoryError('Category is required');
      isValid = false;
    } else if (category.length > QUESTION_VALIDATION.CATEGORY_MAX_LENGTH) {
      setCategoryError(`Category must not exceed ${QUESTION_VALIDATION.CATEGORY_MAX_LENGTH} characters`);
      isValid = false;
    } else {
      setCategoryError('');
    }

    if (!questionText.trim()) {
      setQuestionTextError('Question text is required');
      isValid = false;
    } else if (questionText.length > QUESTION_VALIDATION.QUESTION_TEXT_MAX_LENGTH) {
      setQuestionTextError(`Question text must not exceed ${QUESTION_VALIDATION.QUESTION_TEXT_MAX_LENGTH} characters`);
      isValid = false;
    } else {
      setQuestionTextError('');
    }

    if (!answerText.trim()) {
      setAnswerTextError('Answer text is required');
      isValid = false;
    } else if (answerText.length > QUESTION_VALIDATION.ANSWER_TEXT_MAX_LENGTH) {
      setAnswerTextError(`Answer text must not exceed ${QUESTION_VALIDATION.ANSWER_TEXT_MAX_LENGTH} characters`);
      isValid = false;
    } else {
      setAnswerTextError('');
    }

    if (imageAltText.trim().length > QUESTION_VALIDATION.IMAGE_ALT_TEXT_MAX_LENGTH) {
      setImageAltTextError(`Alt text must not exceed ${QUESTION_VALIDATION.IMAGE_ALT_TEXT_MAX_LENGTH} characters`);
      isValid = false;
    } else {
      setImageAltTextError('');
    }

    return isValid;
  };

  /**
   * Assembles the current form values into a QuestionFormData payload.
   * Optional fields are set to null (not undefined) so a PATCH request
   * can explicitly clear them in the database.
   */
  const buildPayload = (): QuestionFormData => {
    const trimmedImageUrl = imageUrl.trim() || null;
    return {
      category: category.trim(),
      point_value: pointValue,
      question_text: questionText.trim(),
      answer_text: answerText.trim(),
      teacher_notes: teacherNotes.trim() || null,
      image_url: trimmedImageUrl,
      // Only save alt text / size when an image is actually present
      image_alt_text: trimmedImageUrl ? imageAltText.trim() || null : null,
      image_size_mb: trimmedImageUrl ? imageSizeMb : null,
    };
  };

  return {
    // Field state
    category, setCategory,
    useExistingCategory, setUseExistingCategory,
    pointValue, setPointValue,
    questionText, setQuestionText,
    answerText, setAnswerText,
    teacherNotes, setTeacherNotes,
    imageUrl, setImageUrl,
    imageAltText, setImageAltText,
    imageSizeMb, setImageSizeMb,
    // Validation errors
    categoryError,
    questionTextError,
    answerTextError,
    imageAltTextError,
    // Methods
    initForm,
    resetForm,
    validateForm,
    buildPayload,
  };
}
