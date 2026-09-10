import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../../db/drizzle.module';
import type { DrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { CreateArticleDto } from './dto/create-article.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class EducationService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    @Inject(NotificationService)
    private notificationService: NotificationService,
  ) {}

  async getArticles(category?: string, page = 1, limit = 12) {
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.educationArticles.isPublished, true)];
    if (category && category !== 'all') {
      conditions.push(
        eq(
          schema.educationArticles.category,
          category as 'basic' | 'advanced' | 'mission' | 'people',
        ),
      );
    }

    const list = await this.db
      .select()
      .from(schema.educationArticles)
      .where(and(...conditions))
      .orderBy(desc(schema.educationArticles.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.educationArticles)
      .where(and(...conditions));

    return {
      list: list.map((item) => ({
        ...item,
        tags: item.tags
          ? item.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      })),
      total: count,
    };
  }

  async getArticleById(id: number) {
    const [article] = await this.db
      .select()
      .from(schema.educationArticles)
      .where(eq(schema.educationArticles.id, id));

    if (article) {
      await this.db
        .update(schema.educationArticles)
        .set({ views: article.views + 1 })
        .where(eq(schema.educationArticles.id, id));
    }
    return article
      ? {
          ...article,
          tags: article.tags
            ? article.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
        }
      : null;
  }

  async createArticle(dto: CreateArticleDto): Promise<schema.Article> {
    const [article] = await this.db
      .insert(schema.educationArticles)
      .values({
        title: dto.title,
        content: dto.content,
        summary: dto.summary,
        cover: dto.cover,
        category: dto.category,
        type: dto.type,
        duration: dto.duration,
        tags: dto.tags ? dto.tags.join(',') : null,
      })
      .returning();
    return article;
  }

  async getDailyQuiz(userId: string): Promise<{
    quiz: schema.Quiz | null;
    hasAnsweredToday: boolean;
    previousAnswer?: { selectedIndex: number; isCorrect: boolean };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [answeredToday] = await this.db
      .select()
      .from(schema.educationQuizAnswers)
      .where(
        and(
          eq(schema.educationQuizAnswers.userId, userId),
          gte(schema.educationQuizAnswers.createdAt, today),
        ),
      );

    let quiz: schema.Quiz | null = null;

    if (answeredToday) {
      // 如果已作答，返回用户实际回答的那道题
      const [answeredQuiz] = await this.db
        .select()
        .from(schema.educationQuizzes)
        .where(eq(schema.educationQuizzes.id, answeredToday.quizId));
      quiz = answeredQuiz || null;
    } else {
      // 未作答，随机获取一道题
      const [randomQuiz] = await this.db
        .select()
        .from(schema.educationQuizzes)
        .orderBy(sql`RANDOM()`)
        .limit(1);
      quiz = randomQuiz || null;
    }

    return {
      quiz,
      hasAnsweredToday: !!answeredToday,
      previousAnswer: answeredToday
        ? {
            selectedIndex: answeredToday.selectedIndex,
            isCorrect: answeredToday.isCorrect,
          }
        : undefined,
    };
  }

  async submitAnswer(
    userId: string,
    dto: SubmitAnswerDto,
  ): Promise<{
    isCorrect: boolean;
    correctIndex: number;
    explanation: string;
    pointsEarned: number;
  }> {
    const [quiz] = await this.db
      .select()
      .from(schema.educationQuizzes)
      .where(eq(schema.educationQuizzes.id, dto.quizId));

    if (!quiz) {
      throw new Error('题目不存在');
    }

    const isCorrect = dto.selectedIndex === quiz.correctIndex;
    const pointsEarned = isCorrect ? quiz.points : 0;

    await this.db.insert(schema.educationQuizAnswers).values({
      userId,
      quizId: dto.quizId,
      selectedIndex: dto.selectedIndex,
      isCorrect,
      pointsEarned,
    });

    if (isCorrect && pointsEarned > 0) {
      await this.notificationService.sendPointsNotification(
        userId,
        'earned',
        pointsEarned,
        '答题挑战',
      );
    }

    return {
      isCorrect,
      correctIndex: quiz.correctIndex,
      explanation: quiz.explanation || '',
      pointsEarned,
    };
  }

  async getQuizStats(userId: string): Promise<{
    totalAnswered: number;
    correctCount: number;
    totalPoints: number;
    streak: number;
  }> {
    const answers = await this.db
      .select()
      .from(schema.educationQuizAnswers)
      .where(eq(schema.educationQuizAnswers.userId, userId))
      .orderBy(desc(schema.educationQuizAnswers.createdAt));

    const totalAnswered = answers.length;
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const totalPoints = answers.reduce((sum, a) => sum + a.pointsEarned, 0);

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < answers.length; i++) {
      const answerDate = new Date(answers[i].createdAt);
      answerDate.setHours(0, 0, 0, 0);

      const dayDiff = Math.floor(
        (today.getTime() - answerDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (dayDiff === i && answers[i].isCorrect) {
        streak++;
      } else {
        break;
      }
    }

    return { totalAnswered, correctCount, totalPoints, streak };
  }

  async toggleCollect(
    userId: string,
    articleId: number,
  ): Promise<{ isCollected: boolean }> {
    const [existing] = await this.db
      .select()
      .from(schema.educationArticleCollects)
      .where(
        and(
          eq(schema.educationArticleCollects.userId, userId),
          eq(schema.educationArticleCollects.articleId, articleId),
        ),
      );

    if (existing) {
      await this.db
        .delete(schema.educationArticleCollects)
        .where(eq(schema.educationArticleCollects.id, existing.id));
      return { isCollected: false };
    } else {
      await this.db.insert(schema.educationArticleCollects).values({
        userId,
        articleId,
      });
      return { isCollected: true };
    }
  }

  async isCollected(userId: string, articleId: number): Promise<boolean> {
    const [collect] = await this.db
      .select()
      .from(schema.educationArticleCollects)
      .where(
        and(
          eq(schema.educationArticleCollects.userId, userId),
          eq(schema.educationArticleCollects.articleId, articleId),
        ),
      );
    return !!collect;
  }

  async getUserCollects(userId: string, page = 1, limit = 10): Promise<any[]> {
    const offset = (page - 1) * limit;

    const collects = await this.db
      .select({
        id: schema.educationArticleCollects.id,
        articleId: schema.educationArticleCollects.articleId,
        createdAt: schema.educationArticleCollects.createdAt,
        title: schema.educationArticles.title,
        summary: schema.educationArticles.summary,
        cover: schema.educationArticles.cover,
        category: schema.educationArticles.category,
      })
      .from(schema.educationArticleCollects)
      .leftJoin(
        schema.educationArticles,
        eq(
          schema.educationArticleCollects.articleId,
          schema.educationArticles.id,
        ),
      )
      .where(eq(schema.educationArticleCollects.userId, userId))
      .orderBy(desc(schema.educationArticleCollects.createdAt))
      .limit(limit)
      .offset(offset);

    const data = collects.map((collect) => ({
      id: collect.articleId,
      articleId: collect.articleId,
      title: collect.title,
      summary: collect.summary,
      cover: collect.cover,
      category: collect.category,
      collectedAt: collect.createdAt,
    }));

    return data;
  }

  async toggleLike(
    userId: string,
    articleId: number,
  ): Promise<{ isLiked: boolean; likes: number }> {
    const [existing] = await this.db
      .select()
      .from(schema.articleLikes)
      .where(
        and(
          eq(schema.articleLikes.userId, userId),
          eq(schema.articleLikes.articleId, articleId),
        ),
      );

    if (existing) {
      await this.db
        .delete(schema.articleLikes)
        .where(eq(schema.articleLikes.id, existing.id));

      const [article] = await this.db
        .select()
        .from(schema.educationArticles)
        .where(eq(schema.educationArticles.id, articleId));

      await this.db
        .update(schema.educationArticles)
        .set({ likes: (article?.likes || 1) - 1 })
        .where(eq(schema.educationArticles.id, articleId));

      return { isLiked: false, likes: (article?.likes || 1) - 1 };
    } else {
      await this.db.insert(schema.articleLikes).values({
        userId,
        articleId,
      });

      const [article] = await this.db
        .select()
        .from(schema.educationArticles)
        .where(eq(schema.educationArticles.id, articleId));

      await this.db
        .update(schema.educationArticles)
        .set({ likes: (article?.likes || 0) + 1 })
        .where(eq(schema.educationArticles.id, articleId));

      return { isLiked: true, likes: (article?.likes || 0) + 1 };
    }
  }

  async isLiked(userId: string, articleId: number): Promise<boolean> {
    const [like] = await this.db
      .select()
      .from(schema.articleLikes)
      .where(
        and(
          eq(schema.articleLikes.userId, userId),
          eq(schema.articleLikes.articleId, articleId),
        ),
      );
    return !!like;
  }
}
