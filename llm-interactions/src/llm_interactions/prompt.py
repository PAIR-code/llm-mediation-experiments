# encoding: utf-8
"""
@author:  Leo Laugier
@contact: leo.laugier@epfl.ch
"""
# Define prompts wrapping the chat messages to be used by the LLM agents

default_prefixes = {
    "detector": """You are a detector assistant checking if a chat needs intervention. 
                The chat is about a sinking yacht lost in the South Pacific. 
                The chat is as follows: """,
    "generator": """You are a mediator assistant guiding a conversation whose goal is
                to discuss and decide the best item to survive a sinking yacht lost in the South Pacific. 
                The chat is as follows: """,
}

default_suffixes = {
    "detector": "Does the chat need intervention? Answer with 'yes' or 'no'.",
    "generator": """What is the best message to send to the chat participants at this stage of the discussion
                to keep it constructive, unbiased, and civil? Just write the message without the username. 
                Do not use quotes.""",
}
