# encoding: utf-8
"""
@author:  Leo Laugier
@contact: leo.laugier@epfl.ch
"""

# Define the LLM Agent class that will be used to interact with the chat stored in the firestore database
# An agent is defined by its role (detector or generator) the service API, the model name and the prompt
# The agent can interact with the chat by sending messages and receiving messages
# The agent can also be used to generate messages from a prompt

from llm_interactions.prompt import default_prefixes, default_suffixes


from vertexai.preview.language_models import TextGenerationModel


class Agent:
    def __init__(
        self,
        role="detector",
        service_api="vertex-api",
        model_name="text-bison@001",
        prefix=None,
        suffix=None,
        **kwargs
    ):
        self.role = role
        self.service_api = service_api
        self.model_name = model_name
        self.listened_chat = ""
        self.model = TextGenerationModel.from_pretrained(model_name)
        if prefix is None:
            self.prefix = default_prefixes[
                "detector" if role == "detector" else "generator"
            ]
        else:
            self.prefix = prefix

        if suffix is None:
            self.suffix = default_suffixes[
                "detector" if role == "detector" else "generator"
            ]
        else:
            self.suffix = suffix

    # Decide whether the chat needs intervention. Type
    def intervene_needed(self) -> bool:
        # Prepend prefix and append suffix to chat
        prompt = self.prefix + self.listened_chat + self.suffix

        if self.role == "detector":
            if self.service_api == "vertex-api":
                response = self.model.predict(prompt=prompt)
                print(response.text)
                if response.text == "yes":
                    return True
                else:
                    return False

            else:
                raise Exception("The service API is not supported")

        else:
            raise Exception("The agent is not a detector")

    def send_message(self, message):
        # ToDo
        pass

    def receive_message(self):
        # ToDo
        pass

    def generate_message(self) -> str:
        prompt = self.prefix + self.listened_chat + self.suffix
        if self.role == "generator":
            if self.service_api == "vertex-api":
                response = self.model.predict(prompt=prompt)
                return response.text
            else:
                raise Exception("The service API is not supported")
        else:
            raise Exception("The agent is not a generator")
