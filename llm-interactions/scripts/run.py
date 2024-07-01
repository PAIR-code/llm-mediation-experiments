# encoding: utf-8
"""
@author:  Léo Laugier
@contact: leo.laugier@lebret.ch

Usage:
    run.py 
    run.py -h | --help
Options:
    -h --help          show this screen help
"""

from llm_interactions.agent import Agent


def main():
    detector = Agent(
        role="detector",
        service_api="vertex-api",
        model_name="text-bison@001",
    )

    generator = Agent(
        role="generator",
        service_api="vertex-api",
        model_name="text-bison@001",
    )

    chat = "Bob: This is an example chat message.\n Alice: This is another example chat message.\n Charlie: I hate you Alice."
    print(chat)
    detector.listened_chat = chat
    generator.listened_chat = chat

    if detector.intervene_needed():
        print("Alert: Intervention needed")
        intervention = generator.generate_message(chat)
        print(intervention)
    else:
        print("No intervention needed")


if __name__ == "__main__":
    main()
