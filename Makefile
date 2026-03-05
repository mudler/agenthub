.PHONY: build serve clean

build: agents/index.json skills/index.json

agents/index.json: $(wildcard agents/*.json)
	@echo "Generating agents/index.json..."
	@echo '[' > $@.tmp
	@first=true; \
	for f in agents/*.json; do \
		[ "$$(basename "$$f")" = "index.json" ] && continue; \
		[ "$$first" = true ] && first=false || echo ',' >> $@.tmp; \
		jq --arg fn "$$(basename "$$f")" '. + {_filename: $$fn}' "$$f" >> $@.tmp; \
	done
	@echo ']' >> $@.tmp
	@mv $@.tmp $@

skills/index.json: $(wildcard skills/*/SKILL.md)
	@echo "Generating skills/index.json..."
	@python3 -c "\
	import os, json, re; \
	manifest = []; \
	skills_dir = 'skills'; \
	[manifest.append({'name': name, \
	  'title': (re.search(r'^#\s+(.+)$$', open(os.path.join(skills_dir, name, 'SKILL.md')).read(), re.MULTILINE).group(1).strip() \
	    if re.search(r'^#\s+(.+)$$', open(os.path.join(skills_dir, name, 'SKILL.md')).read(), re.MULTILINE) else name), \
	  'content': open(os.path.join(skills_dir, name, 'SKILL.md')).read()}) \
	  for name in sorted(os.listdir(skills_dir)) \
	  if os.path.isfile(os.path.join(skills_dir, name, 'SKILL.md'))]; \
	json.dump(manifest, open(os.path.join(skills_dir, 'index.json'), 'w'), indent=2)"

serve: build
	@echo "Serving at http://localhost:8080"
	@python3 -m http.server 8080

clean:
	rm -f agents/index.json skills/index.json
