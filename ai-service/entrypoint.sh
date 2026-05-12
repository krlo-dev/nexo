#!/bin/bash
ollama serve &
sleep 5
ollama pull nomic-embed-text
ollama pull qwen2.5:0.5b
wait
