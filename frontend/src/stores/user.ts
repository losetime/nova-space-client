import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { authApi, userApi, membershipApi, type User, type UserPermissions, type FeaturePermission } from '@/api'

export const useUserStore = defineStore('user', () => {
  // 状态
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('accessToken'))
  const loading = ref(false)
  const permissions = ref<UserPermissions | null>(null)

  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'super_admin')
  const isVip = computed(() => user.value?.level === 'advanced' || user.value?.level === 'professional')

  // 登录
  async function login(email: string, password: string) {
    loading.value = true
    try {
      const response = await authApi.login({ email, password })
      const data = response.data.data
      const userData = data.user
      const accessToken = data.accessToken ?? data.token

      console.log('Login response:', { userData, accessToken })

      // 保存 Token
      localStorage.setItem('accessToken', accessToken)
      token.value = accessToken
      user.value = userData

      try {
        const response = await membershipApi.getPermissions()
        permissions.value = response.data.data
      } catch (e) {
        console.error('Failed to fetch permissions after login:', e)
      }

      console.log('After login:', { token: token.value, user: user.value, isLoggedIn: isLoggedIn.value })

      return { success: true }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      return { success: false, message: err.response?.data?.message || '登录失败' }
    } finally {
      loading.value = false
    }
  }

  // 注册
  async function register(email: string, password: string, code: string) {
    loading.value = true
    try {
      const response = await authApi.register({ email, password, code })
      const data = response.data.data
      const userData = data.user
      const accessToken = data.accessToken ?? data.token

      // 保存 Token
      localStorage.setItem('accessToken', accessToken)
      token.value = accessToken
      user.value = userData

      try {
        const response = await membershipApi.getPermissions()
        permissions.value = response.data.data
      } catch (e) {
        console.error('Failed to fetch permissions after register:', e)
      }

      return { success: true }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      return { success: false, message: err.response?.data?.message || '注册失败' }
    } finally {
      loading.value = false
    }
  }

  // 登出
  function logout() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    token.value = null
    user.value = null
    permissions.value = null
  }

  // 获取用户信息
  async function fetchUser() {
    if (!token.value) return

    loading.value = true
    try {
      const response = await userApi.getMe()
      user.value = response.data.data
      // 获取用户权限
      await fetchPermissions()
    } catch {
      // Token 无效，清除登录状态
      logout()
    } finally {
      loading.value = false
    }
  }

  // 获取用户功能权限
  async function fetchPermissions() {
    if (!token.value) return

    try {
      const response = await membershipApi.getPermissions()
      permissions.value = response.data.data
    } catch {
      // 忽略错误，permissions 保持 null
    }
  }

  // 检查是否有某个功能权限
  function hasFeature(code: string): boolean {
    if (!permissions.value) return false
    const feature = permissions.value.features.find((f: FeaturePermission) => f.code === code)
    return feature?.hasAccess ?? false
  }

  // 获取功能权限的值
  function getFeatureValue(code: string): string | undefined {
    if (!permissions.value) return undefined
    const feature = permissions.value.features.find((f: FeaturePermission) => f.code === code)
    return feature?.value
  }

  // 更新用户信息
  async function updateUser(data: Partial<User>) {
    loading.value = true
    try {
      const response = await userApi.updateMe(data)
      user.value = response.data.data
      return { success: true }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      return { success: false, message: err.response?.data?.message || '更新失败' }
    } finally {
      loading.value = false
    }
  }

  // 修改密码
  async function changePassword(oldPassword: string, newPassword: string) {
    loading.value = true
    try {
      await userApi.changePassword({ oldPassword, newPassword })
      return { success: true }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      return { success: false, message: err.response?.data?.message || '修改密码失败' }
    } finally {
      loading.value = false
    }
  }

  return {
    // 状态
    user,
    token,
    loading,
    permissions,
    // 计算属性
    isLoggedIn,
    isAdmin,
    isVip,
    // 方法
    login,
    register,
    logout,
    fetchUser,
    fetchPermissions,
    updateUser,
    changePassword,
    hasFeature,
    getFeatureValue,
  }
})