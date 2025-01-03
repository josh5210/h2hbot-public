// /src/handlers/ai-response.ts
import { z } from 'zod';
import { Message, ContentBlock } from '@anthropic-ai/sdk/resources/messages';

// Response validation schemas
const EligibilitySchema = z.object({
  messageId: z.number(),
  isEligible: z.boolean(),
  reasons: z.array(z.string()),
  h2hPoints: z.number().optional()
});

const AIResponseSchema = z.object({
  response: z.string(),
  analysis: z.object({
    eligibleMessages: z.array(EligibilitySchema)
  })
});

export class AIResponseHandler {
//   private static readonly MAX_RETRIES = 3;
  private static readonly FALLBACK_MESSAGE = "I understand your message, but I'm having trouble formatting my response properly. Could you please rephrase your question?";

  /**
   * Clean and parse the AI response with multiple fallback strategies
   */
  static cleanAndParseResponse(rawResponse: string): { 
    response: string; 
    analysis: { eligibleMessages: Array<z.infer<typeof EligibilitySchema>> };
  } {
    // First check if response is plain text (not JSON)
    try {
      // If the response starts with a letter or number, it's likely plain text
      if (/^[A-Za-z0-9]/.test(rawResponse.trim())) {
        console.debug('Detected plain text response');
        return {
          response: rawResponse.trim(),
          analysis: {
            eligibleMessages: []
          }
        };
      }
    } catch (error) {
      console.debug('Error checking for plain text:', error);
    }
    
    // Initialize debug context for better error tracking
    const debugContext = {
        originalLength: rawResponse.length,
        strategies: [] as string[]
      };

    // Try multiple parsing strategies
    for (const strategy of [
      this.directParse.bind(this),
      this.extractJsonFromText.bind(this),
      this.fixCommonJsonIssues.bind(this),
      this.reconstructFromParts.bind(this),
      this.extractFromContentBlock.bind(this)
    ]) {
      try {
        debugContext.strategies.push(strategy.name);
        const result = strategy(rawResponse);
        if (result) {
            // Success logging
            console.debug('Successful parse with strategy:', {
              strategy: strategy.name,
              debugContext
            });
            return result;
          }      
        } catch (error) {
        console.debug(`Parsing strategy failed:`, {
          strategy: strategy.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          debugContext
        });
        // Continue to next strategy
      }
    }

    // If all parsing strategies fail, return a fallback response
    console.debug('All parsing strategies failed, using fallback', { debugContext });
    return this.createFallbackResponse();
  }

  /**
   * Strategy 1: Direct JSON parse
   */
  private static directParse(rawResponse: string) {
    const cleanedResponse = this.removeMessageIdPrefix(rawResponse);
    try {
      const parsed = JSON.parse(cleanedResponse);
      return AIResponseSchema.parse(parsed);
    } catch {
        return null;
        }
    }

  /**
   * Strategy 2: Extract JSON from text
   */
  private static extractJsonFromText(rawResponse: string) {
    const jsonStart = rawResponse.indexOf('{');
    const jsonEnd = rawResponse.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd <= jsonStart) {
      return null;
    }

    try {
        const jsonString = rawResponse.slice(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonString);
        return AIResponseSchema.parse(parsed);
      } catch {
        return null;
      }
    }

  /**
   * Strategy 3: Fix common JSON issues
   */
  private static sanitizeJsonString(str: string): string {
    return str
      // Remove control characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // Escape quotes properly
      .replace(/(?<!\\)"/g, '\\"')
      // Handle apostrophes
      .replace(/'/g, "\\'")
      // Normalize newlines
      .replace(/\r?\n/g, '\\n')
      // Remove extra backslashes
      .replace(/\\\\/g, '\\')
      // Handle template literal backticks
      .replace(/`/g, "'");
  }

  private static fixCommonJsonIssues(rawResponse: string) {
    let cleanedResponse = this.removeMessageIdPrefix(rawResponse);
    
    // Handle case where response contains two separate JSON objects
    if (cleanedResponse.match(/}\s*,?\s*{/)) {
      try {
       // First, extract the full text between the first { and last }
        const fullText = cleanedResponse.slice(
          cleanedResponse.indexOf('{'),
          cleanedResponse.lastIndexOf('}') + 1
        );

        // Split into separate objects
        const parts = fullText.split(/}\s*,?\s*{/);

        let responseText = '';
        let analysisObj = null;

        // Parse each part and identify which is which
        for (const part of parts) {
          const cleanPart = (part.startsWith('{') ? part : '{' + part) + 
                          (part.endsWith('}') ? '' : '}');
            try {
            // Clean the JSON string thoroughly
            const sanitizedPart = this.sanitizeJsonString(cleanPart);
            
            // Try to parse this part
            const parsed = JSON.parse(sanitizedPart);
            
            if ('response' in parsed) {
                responseText = parsed.response;
            }
            if ('analysis' in parsed) {
                analysisObj = parsed.analysis;
            }
            } catch (e) {
            console.debug('Failed to parse part:', { part, error: e });
            }
        }

        // If we found both parts, combine them
        if (responseText && analysisObj) {
            const combined = {
              response: responseText,
              analysis: analysisObj
            };
            
            // Validate against our schema
            const validated = AIResponseSchema.safeParse(combined);
            if (validated.success) {
              return validated.data;
            }
          }
        } catch (e) {
          console.debug('Failed to combine JSON objects:', e);
        }
      }

    // If the above didn't work, proceed with normal cleaning
    cleanedResponse = cleanedResponse.replace(/^[^\{]*(\{)/, '$1');
    cleanedResponse = cleanedResponse.replace(/[\n\r\t]/g, ' ');
    cleanedResponse = cleanedResponse.replace(/\\n/g, '\\\\n');
    cleanedResponse = cleanedResponse.replace(/(?<!\\)\\(?!["\\/bfnrt])/g, '\\\\');
    cleanedResponse = cleanedResponse.replace(/"([^"]*)":/g, (_match, p1) => {
      return `"${p1.replace(/"/g, '\\"')}":`;
    });
    cleanedResponse = cleanedResponse.replace(/,(\s*[}\]])/g, '$1');

    // Balance brackets and braces
    const openBraces = (cleanedResponse.match(/\{/g) || []).length;
    const closeBraces = (cleanedResponse.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      cleanedResponse += '}'.repeat(openBraces - closeBraces);
    }

    try {
      // Try to parse the cleaned response
      let parsed;
      try {
        parsed = JSON.parse(cleanedResponse);
      } catch (parseError) {
        // If parse fails, try wrapping the content in an object
        if (cleanedResponse.includes('"response"') || cleanedResponse.includes('"analysis"')) {
          const wrappedResponse = `{ ${cleanedResponse} }`;
          parsed = JSON.parse(wrappedResponse);
        } else {
          throw parseError;
        }
      }

      // Validate against our schema
      try {
        return AIResponseSchema.parse(parsed);
      } catch (validationError) {
        console.debug('Schema validation error:', {
          error: validationError,
          parsed
        });
        return null;
      }
    } catch (error) {
      // Enhanced error logging
      console.debug('JSON parse error after fixes:', {
        error,
        cleanedResponse: cleanedResponse.substring(0, 100) + '...'
      });
      return null;
    }
  }

  /**
   * Strategy 4: Reconstruct from parts
   */
  private static reconstructFromParts(rawResponse: string) {
    try {
      // Look for key parts of the response
      const responseMatch = rawResponse.match(/"response":\s*"([^"]+)"/);
      const analysisMatch = rawResponse.match(/"analysis":\s*({[^}]+})/);

      if (!responseMatch || !analysisMatch) {
        return null;
      }

      const reconstructed = {
        response: responseMatch[1],
        analysis: JSON.parse(analysisMatch[1])
      };

      return AIResponseSchema.parse(reconstructed);
    } catch {
      return null;
    }
  }

  /**
   * Strategy 5: Extract from content block format
   * Specifically handle Claude's content block format
   */
  private static extractFromContentBlock(rawResponse: string) {
    // Look for the JSON part after the initial text block
    const parts = rawResponse.split('\n{\n');
    if (parts.length < 2) return null;

    // Take the last JSON block
    const jsonPart = '{\n' + parts[parts.length - 1];
    
    try {
      // Apply common fixes to this part
      return this.fixCommonJsonIssues(jsonPart);
    } catch (error) {
      console.debug('Content block extraction failed:', { error });
      return null;
    }
  }

  /**
   * Helper to remove message ID prefix if present
   */
  private static removeMessageIdPrefix(response: string): string {
    return response.replace(/^\[\d+\]\s*[^:]+:\s*/, '');
  }

  /**
   * Create a fallback response using the raw content if available
   */
  private static createFallbackResponse(rawResponse?: string) {
    // If we have raw content from Claude, extract just the text content
    if (rawResponse) {
      try {
        // Remove any message ID prefix
        let cleanContent = this.removeMessageIdPrefix(rawResponse);
        
        // Try to extract just the content between response quotes if possible
        const responseMatch = cleanContent.match(/"response":\s*"([^}]+?)"\s*[,}]/);
        if (responseMatch) {
          cleanContent = responseMatch[1];
        } else {
          // If we can't find the response field, remove any JSON-like structures
          cleanContent = cleanContent
            .replace(/[{}"\\]/g, '')  // Remove JSON syntax
            .replace(/response:|analysis:/g, '')  // Remove field names
            .replace(/eligibleMessages:\s*\[[^\]]*\]/g, ''); // Remove eligibility info
        }

        // Clean up the text
        cleanContent = cleanContent
          .trim()
          .replace(/\n\s*\n/g, '\n') // Remove extra newlines
          .replace(/\\n/g, '\n')     // Convert \n to actual newlines
          .replace(/\s+/g, ' ');     // Normalize whitespace

        if (cleanContent) {
          return {
            response: cleanContent,
            analysis: {
              eligibleMessages: []
            }
          };
        }
      } catch (error) {
        console.debug('Error creating fallback from raw content:', error);
      }
    }

    // If all else fails, use the default message
    return {
      response: this.FALLBACK_MESSAGE,
      analysis: {
        eligibleMessages: []
      }
    };
  }
  
  /**
   * Extract message content from Anthropic response
   * @param response The response from Anthropic API
   */
  static extractMessageContent(response: Message): string {
    try {
      if (response?.content && Array.isArray(response.content)) {
        return response.content
        .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
        .map(block => block.text)
          .join('')
          .trim();
      }
      return '';
    } catch (error) {
      console.error('Error extracting message content:', error);
      return '';
    }
  }
}