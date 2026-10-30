"""
Stream parser for extracting interleaved reasoning tokens (<think>...</think>)
and visible message tokens in real-time.
"""

from __future__ import annotations
from typing import Generator, Tuple


class StreamThoughtParser:
    """
    Stateful streaming parser that separates <think> reasoning tokens from
    visible answer tokens on-the-fly, handling boundary splits across chunks.
    """

    OPEN_TAG = "<think>"
    CLOSE_TAG = "</think>"

    def __init__(self) -> None:
        self.in_thought: bool = False
        self.has_thought: bool = False
        self.accumulated_thought: list[str] = []
        self.accumulated_content: list[str] = []
        self._buffer: str = ""

    def feed(self, chunk: str) -> Generator[Tuple[str, str], None, None]:
        """
        Feeds a chunk of text into the parser.
        Yields tuples of (kind, text_chunk) where kind is:
        - "thought": Token inside <think>...</think>
        - "thought_end": End of thought block
        - "content": Visible content token
        """
        self._buffer += chunk

        # Clean stray rogue backticked think tags that some models leak
        if not self.in_thought and not self.has_thought:
            if self._buffer.startswith("`think`"):
                self._buffer = self._buffer[7:].lstrip()

        while self._buffer:
            if not self.in_thought:
                if self.OPEN_TAG in self._buffer:
                    idx = self._buffer.index(self.OPEN_TAG)
                    prefix = self._buffer[:idx]
                    if prefix:
                        self.accumulated_content.append(prefix)
                        yield ("content", prefix)
                    self._buffer = self._buffer[idx + len(self.OPEN_TAG):]
                    self.in_thought = True
                    self.has_thought = True
                else:
                    # Check if buffer ends with a potential prefix of OPEN_TAG like "<th"
                    potential_prefix_len = 0
                    for i in range(1, len(self.OPEN_TAG)):
                        if self._buffer.endswith(self.OPEN_TAG[:i]):
                            potential_prefix_len = i
                            break

                    if potential_prefix_len > 0:
                        safe_len = len(self._buffer) - potential_prefix_len
                        if safe_len > 0:
                            safe_chunk = self._buffer[:safe_len]
                            self._buffer = self._buffer[safe_len:]
                            self.accumulated_content.append(safe_chunk)
                            yield ("content", safe_chunk)
                        break
                    else:
                        out = self._buffer
                        self._buffer = ""
                        self.accumulated_content.append(out)
                        yield ("content", out)
            else:
                if self.CLOSE_TAG in self._buffer:
                    idx = self._buffer.index(self.CLOSE_TAG)
                    thought_part = self._buffer[:idx]
                    if thought_part:
                        self.accumulated_thought.append(thought_part)
                        yield ("thought", thought_part)
                    self._buffer = self._buffer[idx + len(self.CLOSE_TAG):]
                    self.in_thought = False
                    yield ("thought_end", "")
                else:
                    # Check if buffer ends with potential prefix of CLOSE_TAG like "</th"
                    potential_prefix_len = 0
                    for i in range(1, len(self.CLOSE_TAG)):
                        if self._buffer.endswith(self.CLOSE_TAG[:i]):
                            potential_prefix_len = i
                            break

                    if potential_prefix_len > 0:
                        safe_len = len(self._buffer) - potential_prefix_len
                        if safe_len > 0:
                            safe_chunk = self._buffer[:safe_len]
                            self._buffer = self._buffer[safe_len:]
                            self.accumulated_thought.append(safe_chunk)
                            yield ("thought", safe_chunk)
                        break
                    else:
                        out = self._buffer
                        self._buffer = ""
                        self.accumulated_thought.append(out)
                        yield ("thought", out)

    def finalize(self) -> Generator[Tuple[str, str], None, None]:
        """
        Flushes remaining buffer when stream completes.
        """
        if self._buffer:
            if self.in_thought:
                self.accumulated_thought.append(self._buffer)
                yield ("thought", self._buffer)
                self.in_thought = False
                yield ("thought_end", "")
            else:
                self.accumulated_content.append(self._buffer)
                yield ("content", self._buffer)
            self._buffer = ""
        elif self.in_thought:
            self.in_thought = False
            yield ("thought_end", "")

    @property
    def full_thought(self) -> str:
        return "".join(self.accumulated_thought).strip()

    @property
    def full_content(self) -> str:
        return "".join(self.accumulated_content).strip()
