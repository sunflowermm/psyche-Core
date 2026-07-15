import ConfigBase from '../../../src/infrastructure/commonconfig/commonconfig.js'

export default class PsycheConfig extends ConfigBase {
  constructor() {
    super({
      name: 'psyche',
      displayName: '心理测评',
      description: 'MBTI / 大五人格等标准化心理测评配置',
      filePath: 'data/psyche/psyche.yaml',
      defaultTemplatePath: 'core/psyche-Core/default/psyche.yaml',
      fileType: 'yaml',
      schema: {
        fields: {
          defaultLang: {
            type: 'string',
            label: '默认语言',
            description: '测评界面与 AgentRuntime 回复语言',
            enum: ['zh', 'en'],
            default: 'zh',
            component: 'Select'
          },
          sessionTtlMinutes: {
            type: 'number',
            label: '会话超时（分钟）',
            description: '未完成测评的会话保留时间',
            min: 5,
            max: 120,
            default: 30,
            component: 'InputNumber'
          },
          enabledAssessments: {
            type: 'array',
            label: '启用的测评',
            description: '留空表示启用全部；填写 assessment id 可限制可用量表',
            itemType: 'string',
            default: [],
            component: 'Tags'
          },
          renderResults: {
            type: 'boolean',
            label: '渲染结果图',
            description: 'AgentRuntime 完成测评后生成结果卡片图片（需渲染器）',
            default: true,
            component: 'Switch'
          }
        }
      }
    })
  }
}
