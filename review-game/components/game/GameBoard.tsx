import React from 'react';
import { useGameStore } from '../../lib/stores/gameStore';
import { QuestionCard } from './QuestionCard';


// Define the structure for a category and its questions
interface Category {
  id: string;
  name: string;
  questions: Question[];
}

interface Question {
  id: string;
  value: number;
  text: string;
  isUsed: boolean;
  isDailyDouble?: boolean; // For teacher view
}

export const GameBoard = () => {
  const { allTeams, currentGameData, selectedQuestions, markQuestionUsed, setCurrentQuestion } = useGameStore();

  // Placeholder for game data structure. In a real app, this would come from the store or props.
  // For now, we'll mock it based on the requirements.
  const mockCategories: Category[] = [
    {
      id: 'cat1',
      name: 'Category 1',
      questions: [
        { id: 'q1-1', value: 100, text: 'Question 1.1', isUsed: selectedQuestions.includes('q1-1') },
        { id: 'q1-2', value: 200, text: 'Question 1.2', isUsed: selectedQuestions.includes('q1-2') },
        { id: 'q1-3', value: 300, text: 'Question 1.3', isUsed: selectedQuestions.includes('q1-3') },
        { id: 'q1-4', value: 400, text: 'Question 1.4', isUsed: selectedQuestions.includes('q1-4') },
        { id: 'q1-5', value: 500, text: 'Question 1.5', isUsed: selectedQuestions.includes('q1-5'), isDailyDouble: true },
      ],
    },
    {
      id: 'cat2',
      name: 'Category 2',
      questions: [
        { id: 'q2-1', value: 100, text: 'Question 2.1', isUsed: selectedQuestions.includes('q2-1') },
        { id: 'q2-2', value: 200, text: 'Question 2.2', isUsed: selectedQuestions.includes('q2-2') },
        { id: 'q2-3', value: 300, text: 'Question 2.3', isUsed: selectedQuestions.includes('q2-3') },
        { id: 'q2-4', value: 400, text: 'Question 2.4', isUsed: selectedQuestions.includes('q2-4') },
        { id: 'q2-5', value: 500, text: 'Question 2.5', isUsed: selectedQuestions.includes('q2-5') },
      ],
    },
    {
      id: 'cat3',
      name: 'Category 3',
      questions: [
        { id: 'q3-1', value: 100, text: 'Question 3.1', isUsed: selectedQuestions.includes('q3-1') },
        { id: 'q3-2', value: 200, text: 'Question 3.2', isUsed: selectedQuestions.includes('q3-2') },
        { id: 'q3-3', value: 300, text: 'Question 3.3', isUsed: selectedQuestions.includes('q3-3') },
        { id: 'q3-4', value: 400, text: 'Question 3.4', isUsed: selectedQuestions.includes('q3-4') },
        { id: 'q3-5', value: 500, text: 'Question 3.5', isUsed: selectedQuestions.includes('q3-5') },
      ],
    },
    {
      id: 'cat4',
      name: 'Category 4',
      questions: [
        { id: 'q4-1', value: 100, text: 'Question 4.1', isUsed: selectedQuestions.includes('q4-1') },
        { id: 'q4-2', value: 200, text: 'Question 4.2', isUsed: selectedQuestions.includes('q4-2') },
        { id: 'q4-3', value: 300, text: 'Question 4.3', isUsed: selectedQuestions.includes('q4-3') },
        { id: 'q4-4', value: 400, text: 'Question 4.4', isUsed: selectedQuestions.includes('q4-4') },
        { id: 'q4-5', value: 500, text: 'Question 4.5', isUsed: selectedQuestions.includes('q4-5') },
      ],
    },
    {
      id: 'cat5',
      name: 'Category 5',
      questions: [
        { id: 'q5-1', value: 100, text: 'Question 5.1', isUsed: selectedQuestions.includes('q5-1') },
        { id: 'q5-2', value: 200, text: 'Question 5.2', isUsed: selectedQuestions.includes('q5-2') },
        { id: 'q5-3', value: 300, text: 'Question 5.3', isUsed: selectedQuestions.includes('q5-3') },
        { id: 'q5-4', value: 400, text: 'Question 5.4', isUsed: selectedQuestions.includes('q5-4') },
        { id: 'q5-5', value: 500, text: 'Question 5.5', isUsed: selectedQuestions.includes('q5-5') },
      ],
    },
    {
      id: 'cat6',
      name: 'Category 6',
      questions: [
        { id: 'q6-1', value: 100, text: 'Question 6.1', isUsed: selectedQuestions.includes('q6-1') },
        { id: 'q6-2', value: 200, text: 'Question 6.2', isUsed: selectedQuestions.includes('q6-2') },
        { id: 'q6-3', value: 300, text: 'Question 6.3', isUsed: selectedQuestions.includes('q6-3') },
        { id: 'q6-4', value: 400, text: 'Question 6.4', isUsed: selectedQuestions.includes('q6-4') },
        { id: 'q6-5', value: 500, text: 'Question 6.5', isUsed: selectedQuestions.includes('q6-5') },
      ],
    },
    {
      id: 'cat7',
      name: 'Category 7',
      questions: [
        { id: 'q7-1', value: 100, text: 'Question 7.1', isUsed: selectedQuestions.includes('q7-1') },
        { id: 'q7-2', value: 200, text: 'Question 7.2', isUsed: selectedQuestions.includes('q7-2') },
        { id: 'q7-3', value: 300, text: 'Question 7.3', isUsed: selectedQuestions.includes('q7-3') },
        { id: 'q7-4', value: 400, text: 'Question 7.4', isUsed: selectedQuestions.includes('q7-4') },
        { id: 'q7-5', value: 500, text: 'Question 7.5', isUsed: selectedQuestions.includes('q7-5') },
      ],
    },
  ];

  // Function to handle question selection
  const handleQuestionSelect = (question: Question) => {
    if (!question.isUsed) {
      // In a real app, this would likely involve setting the current question
      // and potentially navigating to a question display view.
      // For now, we'll just mark it as used and set it as current.
      markQuestionUsed(question.id);
      setCurrentQuestion(question);
      console.log(`Selected question: ${question.text} (${question.value})`);
    } else {
      console.log(`Question ${question.text} has already been used.`);
    }
  };

  return (
    <div className="game-board">
      <h2 className="text-2xl font-bold mb-4">Game Board</h2>
      <div className="grid grid-cols-7 gap-2">
        {/* Render Categories */}
        {mockCategories.map((category) => (
          <React.Fragment key={category.id}>
            {/* Category Header */}
            <div className="category-header p-2 bg-blue-500 text-white font-bold flex items-center justify-center">
              {category.name}
            </div>
            {/* Render Questions for this Category */}
            {category.questions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                onSelect={handleQuestionSelect}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};