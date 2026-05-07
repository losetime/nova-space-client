import { test, expect } from "@playwright/test";

const testUser = {
  username: `test_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  password: "Test123456",
};

test.describe("星瞰 前端测试", () => {
  test("首页加载", async ({ page }) => {
    await page.goto("/");
    // 首页 h1 文案是 "探索宇宙 从这里开始"
    await expect(page.locator('h1:has-text("探索宇宙")')).toBeVisible({ timeout: 10000 });
  });

  test("用户注册", async ({ page }) => {
    await page.goto("/register");

    // 等待页面加载 - auth-card 存在
    await expect(page.locator(".auth-card")).toBeVisible({ timeout: 10000 });

    // 切换到注册表单
    await page.click('.ant-tabs-tab:has-text("注册")');

    // 等待注册表单出现
    await page.waitForTimeout(500);

    // 填写注册表单 - 使用 getByPlaceholder 更可靠
    await page.getByPlaceholder("请输入用户名").fill(testUser.username);
    await page.getByPlaceholder("请输入邮箱").fill(testUser.email);
    await page.getByPlaceholder("请输入密码（至少6位）").fill(testUser.password);
    await page.getByPlaceholder("请再次输入密码").fill(testUser.password);

    // 提交注册
    await page.click('.ant-btn-primary:has-text("注册")');

    // 等待注册成功，应该跳转到首页
    await page.waitForURL(/\/$/, { timeout: 15000 });

    // 验证已登录状态 - 检查用户名显示
    await expect(page.locator(`text=${testUser.username}`)).toBeVisible({ timeout: 10000 });
  });

  test("用户登录", async ({ page }) => {
    await page.goto("/login");

    // 等待页面加载
    await expect(page.locator(".auth-card")).toBeVisible({ timeout: 10000 });

    // 确保在登录表单 (默认就是登录)
    await page.click('.ant-tabs-tab:has-text("登录")');
    await page.waitForTimeout(500);

    // 填写登录表单 - 使用 getByPlaceholder
    await page.getByPlaceholder("请输入用户名").fill(testUser.username);
    await page.getByPlaceholder("请输入密码").fill(testUser.password);

    // 提交登录
    await page.click('.ant-btn-primary:has-text("登录")');

    // 等待登录成功
    await page.waitForURL(/\/$/, { timeout: 15000 });

    // 验证已登录状态
    await expect(page.locator(`text=${testUser.username}`)).toBeVisible({ timeout: 10000 });
  });

  test("个人中心", async ({ page }) => {
    // 先登录
    await page.goto("/login");
    await expect(page.locator(".auth-card")).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder("请输入用户名").fill(testUser.username);
    await page.getByPlaceholder("请输入密码").fill(testUser.password);
    await page.click('.ant-btn-primary:has-text("登录")');
    await page.waitForURL(/\/$/, { timeout: 15000 });

    // 进入个人中心
    await page.click("text=个人中心");
    await expect(page).toHaveURL(/\/profile/, { timeout: 10000 });

    // 验证用户信息显示
    await expect(page.locator(`text=${testUser.username}`)).toBeVisible({ timeout: 5000 });
  });

  test("退出登录", async ({ page }) => {
    // 先登录
    await page.goto("/login");
    await expect(page.locator(".auth-card")).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder("请输入用户名").fill(testUser.username);
    await page.getByPlaceholder("请输入密码").fill(testUser.password);
    await page.click('.ant-btn-primary:has-text("登录")');
    await page.waitForURL(/\/$/, { timeout: 15000 });

    // 点击退出
    await page.click("text=退出");

    // 验证已退出，应该显示登录按钮
    await expect(page.locator("text=登录")).toBeVisible({ timeout: 5000 });
  });
});
