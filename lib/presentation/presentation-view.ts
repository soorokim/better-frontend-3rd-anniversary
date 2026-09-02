export type AvatarSnapshot = {
  generatorVersion: string;
  catalogVersion: string;
  traits: Record<string, string>;
};

export type AnswerAuthorView = {
  nickname: string;
  avatar: AvatarSnapshot;
};

export type PresentationAnswerStatus = 'unpresented' | 'presented' | 'current';

export type PresentationAnswerView = {
  id: string;
  content: string;
  submittedAt: string;
  updatedAt: string;
  status: PresentationAnswerStatus;
  presentationOrder: number | null;
  author: AnswerAuthorView;
};

export type ControllerSlideView = {
  itemId: string;
  answerId: string;
  content: string;
  author: AnswerAuthorView;
  authorRevealed: boolean;
  presentationOrder: number;
};

export type PresentationControllerView = {
  question: { id: string; prompt: string };
  progress: {
    currentQuestion: number;
    questionCount: number;
    hasNextQuestion: boolean;
    completed: boolean;
  };
  archivePublished: boolean;
  summary: { total: number; submitted: number; notSubmitted: number };
  session: {
    revision: number;
    currentItemId: string | null;
    authorRevealed: boolean;
    allPresented: boolean;
    updatedAt: string | null;
  };
  currentSlide: ControllerSlideView | null;
  answers: PresentationAnswerView[];
};

export type WaitingScreenSlide = { kind: 'waiting' };
export type CompletedScreenSlide = { kind: 'completed' };
export type AnonymousAnswerScreenSlide = { kind: 'answer'; content: string };
export type RevealedAnswerScreenSlide = AnonymousAnswerScreenSlide & { author: AnswerAuthorView };

export type PresentationScreenView = {
  question: { id: string; prompt: string };
  revision: number;
  updatedAt: string | null;
  slide: WaitingScreenSlide | CompletedScreenSlide | AnonymousAnswerScreenSlide | RevealedAnswerScreenSlide;
};

export function buildPresentationScreenView(
  controller: PresentationControllerView,
): PresentationScreenView {
  const base = {
    question: {
      id: controller.question.id,
      prompt: controller.question.prompt,
    },
    revision: controller.session.revision,
    updatedAt: controller.session.updatedAt,
  };

  if (!controller.currentSlide) {
    return {
      ...base,
      slide: controller.progress.completed ? { kind: 'completed' } : { kind: 'waiting' },
    };
  }

  if (!controller.currentSlide.authorRevealed) {
    return {
      ...base,
      slide: {
        kind: 'answer',
        content: controller.currentSlide.content,
      },
    };
  }

  return {
    ...base,
    slide: {
      kind: 'answer',
      content: controller.currentSlide.content,
      author: {
        nickname: controller.currentSlide.author.nickname,
        avatar: {
          generatorVersion: controller.currentSlide.author.avatar.generatorVersion,
          catalogVersion: controller.currentSlide.author.avatar.catalogVersion,
          traits: { ...controller.currentSlide.author.avatar.traits },
        },
      },
    },
  };
}

type ControllerViewInput = {
  question: { id: string; prompt: string };
  progress?: PresentationControllerView['progress'];
  archivePublished?: boolean;
  participantCount: number;
  session: {
    revision: number;
    currentItemId: string | null;
    authorRevealed: boolean;
    updatedAt: Date;
  } | null;
  currentSlide: {
    itemId: string;
    answerId: string;
    content: string;
    nickname: string;
    avatar: AvatarSnapshot;
    presentationOrder: number;
  } | null;
  answers: Array<{
    id: string;
    content: string;
    submittedAt: Date;
    updatedAt: Date;
    nickname: string;
    avatar: AvatarSnapshot;
    presentationItemId: string | null;
    presentationOrder: number | null;
  }>;
};

export function buildPresentationControllerView(input: ControllerViewInput): PresentationControllerView {
  const submitted = input.answers.length;
  const currentItemId = input.session?.currentItemId ?? null;
  const authorRevealed = input.session?.authorRevealed ?? false;
  const currentSlide = input.currentSlide ? {
    itemId: input.currentSlide.itemId,
    answerId: input.currentSlide.answerId,
    content: input.currentSlide.content,
    author: {
      nickname: input.currentSlide.nickname,
      avatar: input.currentSlide.avatar,
    },
    authorRevealed,
    presentationOrder: input.currentSlide.presentationOrder,
  } : null;

  return {
    question: { id: input.question.id, prompt: input.question.prompt },
    progress: input.progress ?? {
      currentQuestion: 1,
      questionCount: 1,
      hasNextQuestion: false,
      completed: false,
    },
    archivePublished: input.archivePublished ?? false,
    summary: {
      total: input.participantCount,
      submitted,
      notSubmitted: Math.max(0, input.participantCount - submitted),
    },
    session: {
      revision: input.session?.revision ?? 0,
      currentItemId,
      authorRevealed,
      allPresented: input.answers.every((answer) => answer.presentationItemId !== null),
      updatedAt: input.session?.updatedAt.toISOString() ?? null,
    },
    currentSlide,
    answers: input.answers.map((answer) => ({
      id: answer.id,
      content: answer.content,
      submittedAt: answer.submittedAt.toISOString(),
      updatedAt: answer.updatedAt.toISOString(),
      status: answer.presentationItemId !== null && answer.presentationItemId === currentItemId
        ? 'current'
        : answer.presentationItemId
          ? 'presented'
          : 'unpresented',
      presentationOrder: answer.presentationOrder,
      author: {
        nickname: answer.nickname,
        avatar: answer.avatar,
      },
    })),
  };
}
