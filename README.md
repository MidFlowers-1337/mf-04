# 书影音收藏追踪系统

本地运行的个人书影音收藏管理工具，支持书籍、影视、音乐三类条目的记录、进度追踪和年度统计。

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
flask run
```

或直接运行：

```bash
python app.py
```

服务默认在 `http://localhost:5000` 启动。

## 功能说明

### 1. 条目录入
- 支持三类：书籍、影视、音乐
- 字段：标题、作者/导演/艺人、类型标签、评分（1-5星）、短评、状态（想看/在看/看过）、开始/结束日期
- 影视额外支持总集数和当前集数

### 2. 进度追踪
- 在看状态的影视可更新当前集数，前端显示进度条
- 当前集数等于总集数时自动转为"看过"并填入结束日期

### 3. 年度统计看板
- 按年份查看新增条目数、按类型分布、平均评分
- 按月消费热力图（堆叠柱状图）
- 类型分布饼图
- 全部使用原生 SVG 绘制

### 4. 想看清单
- 独立页面列出所有"想看"状态条目
- 支持 HTML5 原生拖拽排序
- 支持一键置顶

### 5. 导入导出
- 导出全部数据为 JSON 备份
- 从 JSON 导入恢复，自动校验格式
- 重复条目（标题+类型相同）自动跳过

## 项目结构

```
.
├── app.py                  # Flask 应用入口
├── schema.sql              # SQLite 建表脚本
├── requirements.txt        # Python 依赖
├── models/
│   ├── __init__.py
│   └── repository.py       # 数据访问层（SQL 操作）
├── services/
│   ├── __init__.py
│   ├── items.py            # 条目业务逻辑
│   ├── stats.py            # 统计聚合逻辑
│   └── import_export.py    # 导入导出逻辑
├── routes/
│   ├── __init__.py
│   ├── items.py            # 条目 API 路由
│   ├── stats.py            # 统计 API 路由
│   └── import_export.py    # 导入导出 API 路由
├── templates/
│   ├── index.html          # 首页
│   ├── stats.html          # 统计看板
│   └── wantlist.html       # 想看清单
└── static/
    ├── css/style.css
    └── js/
        ├── app.js
        ├── stats.js
        └── wantlist.js
```

## 数据文件

SQLite 数据库文件位于 `instance/tracker.db`，首次启动自动创建。

## API 接口

### 条目管理
- `GET /api/items` - 获取条目列表（支持 `?type=` 和 `?status=` 筛选）
- `POST /api/items` - 创建条目
- `GET /api/items/<id>` - 获取单条
- `PUT /api/items/<id>` - 更新条目
- `DELETE /api/items/<id>` - 删除条目
- `PUT /api/items/<id>/episode` - 更新影视集数

### 想看清单
- `GET /api/items/wantlist` - 获取想看清单
- `PUT /api/items/wantlist/reorder` - 重新排序
- `POST /api/items/<id>/pin` - 置顶条目

### 统计
- `GET /api/stats/yearly/<year>` - 获取年度统计
- `GET /api/stats/years` - 获取有数据的年份列表

### 导入导出
- `GET /api/export` - 导出 JSON
- `POST /api/import` - 导入 JSON（multipart/form-data, file 字段）
