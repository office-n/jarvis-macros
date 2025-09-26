SCHEMA = schema/macros.schema.json
TARGET ?= macros.json

.PHONY: validate
validate:
	@./validate-macros.sh $(TARGET)

.PHONY: validate-all
validate-all:
	@for f in macros.json $(shell ls macros*.json 2>/dev/null); do ./validate-macros.sh $$f; done

.PHONY: bad  # わざと不正ファイルを生成→検証（動作確認用）
bad:
	@printf '{ "version":"1.0", "steps":[] }\n' > macros.bad.json
	@./validate-macros.sh macros.bad.json || true

.PHONY: clean
clean:
	@rm -f macros.bad.json
