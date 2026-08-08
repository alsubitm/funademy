import { describe, expect, it } from "vitest";
import { gradeAnswers } from "./grading";

const key = [
  { id: 1, correctAnswer: "A" },
  { id: 2, correctAnswer: "B" },
  { id: 3, correctAnswer: "C" },
];

describe("gradeAnswers", () => {
  it("scores 100 for a fully correct submission", () => {
    const { score } = gradeAnswers(
      [
        { exerciseId: 1, answer: "A" },
        { exerciseId: 2, answer: "B" },
        { exerciseId: 3, answer: "C" },
      ],
      key,
    );
    expect(score).toBe(100);
  });

  it("grades against the stored key, not client claims", () => {
    const { score } = gradeAnswers(
      [
        { exerciseId: 1, answer: "wrong" },
        { exerciseId: 2, answer: "wrong" },
        { exerciseId: 3, answer: "wrong" },
      ],
      key,
    );
    expect(score).toBe(0);
  });

  it("scores over all exercises so omitted answers count as wrong", () => {
    const { score } = gradeAnswers([{ exerciseId: 1, answer: "A" }], key);
    expect(score).toBe(33);
  });

  it("ignores duplicate submissions for the same exercise", () => {
    const { score, correctCount } = gradeAnswers(
      [
        { exerciseId: 1, answer: "wrong" },
        { exerciseId: 1, answer: "A" },
        { exerciseId: 1, answer: "A" },
      ],
      key,
    );
    expect(correctCount).toBe(0);
    expect(score).toBe(0);
  });

  it("ignores answers for exercises outside the lesson", () => {
    const { score } = gradeAnswers(
      [
        { exerciseId: 999, answer: "A" },
        { exerciseId: 1000, answer: "B" },
      ],
      key,
    );
    expect(score).toBe(0);
  });

  it("scores 100 for a lesson with no exercises", () => {
    expect(gradeAnswers([], []).score).toBe(100);
  });

  it("trims whitespace before comparing", () => {
    const { score } = gradeAnswers(
      [{ exerciseId: 1, answer: " A " }],
      [{ id: 1, correctAnswer: "A" }],
    );
    expect(score).toBe(100);
  });
});
