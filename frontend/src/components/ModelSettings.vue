<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { useModelStore } from '../stores/models'
import { useUiStore } from '../stores/ui'
import { fetchAvailableModels, testModel } from '../api'

const props = defineProps({
  open: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

const store = useModelStore()
const ui = useUiStore()

const view = ref('list')
const showKey = ref(false)
const testing = ref(false)
const modelsLoading = ref(false)
const modelsError = ref('')
const availableModels = ref([])
const manualModel = ref(false)
const lastFetchSignature = ref('')
const testedFingerprint = ref('')
const testState = reactive({
  status: 'idle',
  message: '',
  latency: 0
})

const form = reactive(blankForm())

const fingerprint = computed(() =>
  JSON.stringify([
    form.name,
    form.baseUrl,
    form.model,
    form.apiKey,
    Number(form.temperature)
  ])
)

const canSave = computed(
  () =>
    testState.status === 'success' &&
    Boolean(testedFingerprint.value) &&
    testedFingerprint.value === fingerprint.value
)

function blankForm() {
  return {
    id: null,
    name: 'DeepSeek Chat',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    apiKey: '',
    temperature: 0.25
  }
}

function resetForm(model = null) {
  Object.assign(
    form,
    model
      ? {
          id: model.id,
          name: model.name,
          baseUrl: model.baseUrl,
          model: model.model,
          apiKey: model.apiKey,
          temperature: model.temperature
        }
      : blankForm()
  )
  testState.status = 'idle'
  testState.message = ''
  testState.latency = 0
  testedFingerprint.value = ''
  showKey.value = false
  availableModels.value = []
  modelsError.value = ''
  modelsLoading.value = false
  manualModel.value = false
  lastFetchSignature.value = ''
}

function providerSignature() {
  return `${form.baseUrl.trim()}|${form.apiKey.trim()}`
}

async function fetchModels(force = false) {
  const baseUrl = form.baseUrl.trim()
  const apiKey = form.apiKey.trim()
  if (!baseUrl || modelsLoading.value) return

  const signature = `${baseUrl}|${apiKey}`
  if (!force && signature === lastFetchSignature.value && availableModels.value.length) return

  modelsLoading.value = true
  modelsError.value = ''

  try {
    const result = await fetchAvailableModels({ baseUrl, apiKey })
    if (signature !== providerSignature()) return

    availableModels.value = result.models || []
    lastFetchSignature.value = signature
    if (!form.model || !availableModels.value.includes(form.model)) {
      form.model = availableModels.value[0] || ''
    }
    manualModel.value = false
  } catch (error) {
    if (signature !== providerSignature()) return
    availableModels.value = []
    modelsError.value = error.message || '获取模型列表失败'
  } finally {
    modelsLoading.value = false
  }
}

function maybeFetchModels() {
  if (form.baseUrl.trim() && form.apiKey.trim()) fetchModels(false)
}

function toggleManualModel() {
  manualModel.value = !manualModel.value
  if (!manualModel.value && availableModels.value.length) {
    form.model = availableModels.value.includes(form.model)
      ? form.model
      : availableModels.value[0]
  }
}

watch([() => form.baseUrl, () => form.apiKey], () => {
  availableModels.value = []
  modelsError.value = ''
  lastFetchSignature.value = ''
  manualModel.value = false
})

watch(fingerprint, () => {
  if (testState.status !== 'idle') {
    testState.status = 'idle'
    testState.message = ''
    testState.latency = 0
    testedFingerprint.value = ''
  }
})

watch(
  () => props.open,
  (open) => {
    document.body.classList.toggle('model-open', open)
    if (open) {
      view.value = store.models.length ? 'list' : 'form'
      if (!store.models.length) resetForm()
    }
  },
  { immediate: true }
)

function startCreate() {
  resetForm()
  view.value = 'form'
}

function startEdit(model) {
  resetForm(model)
  view.value = 'form'
  if (model.baseUrl && model.apiKey) fetchModels(true)
}

function backToList() {
  if (testing.value) return
  view.value = 'list'
}

async function runTest() {
  if (testing.value) return
  if (!form.apiKey.trim()) {
    testState.status = 'error'
    testState.message = '请先填写 API Key'
    return
  }
  if (!form.model.trim() || !form.baseUrl.trim()) {
    testState.status = 'error'
    testState.message = '请填写 Base URL 和模型 ID'
    return
  }

  testing.value = true
  testState.status = 'testing'
  testState.message = '正在请求模型服务…'
  testState.latency = 0
  const testedValues = fingerprint.value

  try {
    const result = await testModel({
      baseUrl: form.baseUrl.trim(),
      model: form.model.trim(),
      apiKey: form.apiKey.trim(),
      temperature: Number(form.temperature)
    })
    if (fingerprint.value !== testedValues) {
      testedFingerprint.value = ''
      testState.status = 'idle'
      testState.message = ''
      testState.latency = 0
      return
    }
    testedFingerprint.value = testedValues
    testState.status = 'success'
    testState.latency = result.latencyMs
    testState.message = `连接成功${result.reply ? ` · ${result.reply}` : ''}`
  } catch (error) {
    if (fingerprint.value !== testedValues) return
    testedFingerprint.value = ''
    testState.status = 'error'
    testState.message = error.message || '连接失败'
  } finally {
    testing.value = false
  }
}

function save() {
  if (!canSave.value) return
  const model = store.saveModel({
    ...form,
    name: form.name.trim() || form.model.trim(),
    baseUrl: form.baseUrl.trim(),
    model: form.model.trim(),
    apiKey: form.apiKey.trim(),
    temperature: Number(form.temperature)
  })
  if (!model) {
    ui.toast('模型配置不完整', 'error')
    return
  }
  ui.toast(`已启用 ${model.name}`, 'success')
  emit('close')
}

function activate(model) {
  store.activate(model.id)
  ui.toast(`已切换到 ${model.name}`, 'success')
}

function remove(model) {
  if (!window.confirm(`确定删除模型「${model.name}」吗？`)) return
  store.removeModel(model.id)
  ui.toast('模型配置已删除', 'success')
  if (!store.models.length) startCreate()
}

function maskKey(key) {
  if (!key) return '未填写'
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 3)}••••••${key.slice(-4)}`
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value))
  } catch {
    return ''
  }
}

function onKeydown(event) {
  if (event.key === 'Escape' && props.open) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('model-open')
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="drawer-backdrop" @click="emit('close')" />
    </Transition>

    <Transition name="drawer">
      <aside v-if="open" class="model-drawer" aria-label="模型设置">
        <header class="drawer-head model-drawer-head">
          <div>
            <p class="drawer-kicker"><AppIcon name="sliders" :size="13" /> MODELS</p>
            <h2>{{ view === 'form' ? '配置模型' : '模型设置' }}</h2>
          </div>
          <button class="icon-button" title="关闭" @click="emit('close')">
            <AppIcon name="close" :size="19" />
          </button>
        </header>

        <div class="model-key-note">
          <AppIcon name="alert" :size="14" />
          <span>API Key 仅保存在当前浏览器 localStorage，并随请求发送到本机 Node 服务。请勿在公共电脑使用。</span>
        </div>

        <div v-if="view === 'list'" class="model-list-panel">
          <div class="model-list-head">
            <span>{{ store.models.length }} 个模型配置</span>
            <button type="button" class="model-add-button" @click="startCreate">
              <AppIcon name="plus" :size="14" />
              添加模型
            </button>
          </div>

          <div class="model-list">
            <article
              v-for="model in store.models"
              :key="model.id"
              class="model-card"
              :class="{ active: model.id === store.activeId }"
            >
              <div class="model-card-top">
                <span class="model-card-icon">
                  <AppIcon name="sparkles" :size="17" />
                </span>
                <div class="model-card-title">
                  <strong>{{ model.name }}</strong>
                  <span>{{ model.model }}</span>
                </div>
                <span v-if="model.id === store.activeId" class="model-active-badge">
                  使用中
                </span>
              </div>

              <dl class="model-card-meta">
                <div>
                  <dt>Base URL</dt>
                  <dd :title="model.baseUrl">{{ model.baseUrl }}</dd>
                </div>
                <div>
                  <dt>API Key</dt>
                  <dd>{{ maskKey(model.apiKey) }}</dd>
                </div>
                <div>
                  <dt>最近测试</dt>
                  <dd>{{ formatDate(model.testedAt) }}</dd>
                </div>
              </dl>

              <div class="model-card-actions">
                <button
                  v-if="model.id !== store.activeId"
                  type="button"
                  class="model-action primary"
                  @click="activate(model)"
                >
                  启用
                </button>
                <span v-else class="model-action-status">
                  <span class="status-dot online" />
                  当前聊天使用
                </span>
                <button type="button" class="model-action" @click="startEdit(model)">
                  编辑
                </button>
                <button type="button" class="model-action danger" @click="remove(model)">
                  删除
                </button>
              </div>
            </article>

            <div v-if="!store.models.length" class="model-empty">
              <AppIcon name="sliders" :size="24" />
              <p>还没有模型配置</p>
              <button type="button" @click="startCreate">添加第一个模型</button>
            </div>
          </div>
        </div>

        <div v-else class="model-form-panel">
          <button type="button" class="model-back" :disabled="testing" @click="backToList">
            <AppIcon name="chevron-down" :size="14" class="back-icon" />
            返回模型列表
          </button>

          <label class="model-field">
            <span>显示名称</span>
            <input v-model="form.name" maxlength="40" placeholder="例如 DeepSeek Chat" />
            <small>仅用于界面展示和区分多个模型，不影响实际调用。</small>
          </label>

          <label class="model-field">
            <span>Base URL</span>
            <div class="model-input-action">
              <input
                v-model="form.baseUrl"
                maxlength="300"
                placeholder="https://api.deepseek.com"
                spellcheck="false"
                @blur="maybeFetchModels"
              />
              <button
                type="button"
                class="model-fetch-button"
                :disabled="modelsLoading"
                @click="fetchModels(true)"
              >
                <span v-if="modelsLoading" class="mini-spinner" />
                <AppIcon v-else name="refresh" :size="13" />
                {{ modelsLoading ? '获取中' : '获取模型' }}
              </button>
            </div>
            <small>
              兼容 OpenAI 协议的接口根地址，例如 https://api.deepseek.com；
              不要填写完整的 /chat/completions。填写 Key 后会自动拉取 /models。
            </small>
          </label>

          <div class="model-field">
            <span>模型 ID</span>
            <select
              v-if="availableModels.length && !manualModel"
              v-model="form.model"
              class="model-select"
            >
              <option value="" disabled>请选择模型</option>
              <option v-for="modelId in availableModels" :key="modelId" :value="modelId">
                {{ modelId }}
              </option>
            </select>
            <input
              v-else
              v-model="form.model"
              maxlength="120"
              placeholder="deepseek-chat"
              spellcheck="false"
              @blur="maybeFetchModels"
            />
            <div class="model-field-foot">
              <small v-if="availableModels.length">
                已从 /models 获取 {{ availableModels.length }} 个模型
              </small>
              <small v-else-if="modelsError" class="model-fetch-error">
                {{ modelsError }}
              </small>
              <small v-else>服务商文档中的模型标识，也可以手动填写。</small>
              <button
                v-if="availableModels.length"
                type="button"
                class="model-manual-toggle"
                @click="toggleManualModel"
              >
                {{ manualModel ? '从列表选择' : '手动输入' }}
              </button>
            </div>
          </div>

          <label class="model-field">
            <span>API Key</span>
            <div class="model-key-input">
              <input
                v-model="form.apiKey"
                :type="showKey ? 'text' : 'password'"
                maxlength="300"
                placeholder="sk-..."
                autocomplete="off"
                spellcheck="false"
                @blur="maybeFetchModels"
              />
              <button type="button" @click="showKey = !showKey">
                {{ showKey ? '隐藏' : '显示' }}
              </button>
            </div>
            <small>仅保存在当前浏览器 localStorage，聊天时随请求发送给本机 Node 服务。</small>
          </label>

          <div class="model-form-row">
            <label class="model-field">
              <span>Temperature</span>
              <input
                v-model.number="form.temperature"
                type="number"
                min="0"
                max="2"
                step="0.05"
              />
              <small>取值 0–2，越低越稳定。知识库问答建议 0.1–0.3。</small>
            </label>
            <div class="model-field model-preset-field">
              <span>快捷配置</span>
              <div class="model-preset">
                <span>DeepSeek 预设</span>
                <button
                  type="button"
                  @click="
                    form.baseUrl = 'https://api.deepseek.com';
                    form.model = 'deepseek-chat';
                    form.name = form.name || 'DeepSeek Chat'
                  "
                >
                  填入
                </button>
              </div>
              <small>自动填入官方地址和模型 ID，API Key 仍需手动填写。</small>
            </div>
          </div>

          <div class="model-test-result" :class="testState.status">
            <span class="test-dot">
              <span v-if="testState.status === 'testing'" class="mini-spinner" />
              <AppIcon
                v-else-if="testState.status === 'success'"
                name="check"
                :size="12"
              />
              <AppIcon
                v-else-if="testState.status === 'error'"
                name="alert"
                :size="12"
              />
              <AppIcon v-else name="link" :size="12" />
            </span>
            <span v-if="testState.status === 'idle'">保存前必须先通过连接测试</span>
            <span v-else>{{ testState.message }}</span>
            <b v-if="testState.status === 'success'">{{ testState.latency }}ms</b>
          </div>

          <div class="model-form-actions">
            <button
              type="button"
              class="model-test-button"
              :disabled="testing"
              @click="runTest"
            >
              <span v-if="testing" class="mini-spinner" />
              <AppIcon v-else name="link" :size="15" />
              {{ testing ? '正在测试…' : '测试连接' }}
            </button>
            <button
              type="button"
              class="model-save-button"
              :disabled="!canSave"
              @click="save"
            >
              <AppIcon name="check" :size="15" />
              保存并启用
            </button>
          </div>

          <p class="model-form-hint">
            修改任意字段后需要重新测试。测试成功前，“保存并启用”不可用。
          </p>
        </div>

        <footer class="drawer-foot">
          <AppIcon name="database" :size="14" />
          模型配置只影响聊天生成，不会删除知识库文档
        </footer>
      </aside>
    </Transition>
  </Teleport>
</template>
