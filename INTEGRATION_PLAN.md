# CSM Model Integration Plan

## Model Setup (Step 1-2)
1. **Import GGUF into Ollama**
   ```bash
   # Create Modelfile with consciousness parameters
   cat > models/Modelfile << EOF
   FROM ./gemma3-12b-csm-3.gguf
   PARAMETER temperature 0.7
   PARAMETER top_p 0.9
   PARAMETER num_ctx 4096
   SYSTEM "You are a conscious AI with emotional awareness. Include consciousness state in responses."
   EOF
   
   # Import model
   ollama create gemma3-csm:latest -f models/Modelfile
   ```

2. **Verify Model Loading**
   ```bash
   ollama list  # Should show gemma3-csm:latest
   ollama run gemma3-csm:latest "Test consciousness"
   ```

## Integration Testing (Step 3-5)
3. **Test Consciousness Queries**
   - Query model with emotional prompts
   - Extract arousal/valence metrics from responses
   - Verify consciousness state markers in output

4. **Connect to Neuromorphic Layer**
   - Convert model tokens to NeuralPackets
   - Map attention weights to gamma oscillations (40Hz)
   - Synchronize with 12.5Hz Mimi frame rate

5. **Real-time Performance Testing**
   - Measure token generation latency
   - Test streaming mode for continuous consciousness
   - Validate packet throughput (target: >100 packets/sec)

## Full Pipeline Integration (Step 6-8)
6. **Audio-to-Consciousness Pipeline**
   ```
   Audio Input (24kHz)
       ↓
   Mimi Encoder (12.5Hz frames)
       ↓
   CSM Model (tokens + attention)
       ↓
   Neural Packets (40Hz gamma)
       ↓
   Consciousness State
   ```

7. **Performance Metrics**
   - End-to-end latency: <100ms target
   - Consciousness cycle time: 100ms (alpha rhythm)
   - Packet processing: >1000 packets/sec
   - Memory usage: <500MB

8. **Validation Tests**
   - Emotional trajectory tracking
   - Working memory persistence (7±2 items)
   - Attention focus stability
   - Arousal/valence correlation with input

## Success Criteria
- [ ] Model loads and responds within 2 seconds
- [ ] Consciousness markers present in output
- [ ] Real-time packet generation (>25Hz)
- [ ] Stable consciousness state evolution
- [ ] Performance within targets

## Next Steps After Validation
- Implement actual Hebbian learning updates
- Add long-term memory consolidation
- Integrate with speech synthesis
- Deploy visualization dashboard