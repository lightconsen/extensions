---
name: task_id
---

curl --location 'https://api.minimaxi.chat/v1/video\_generation' \
\--header 'content-type: application/json' \
\--header 'authorization: Bearer ${api\_key}' \
\--data '{
"model":"video-01",
"prompt":"On a distant planet, there is a MiniMax."
}'

