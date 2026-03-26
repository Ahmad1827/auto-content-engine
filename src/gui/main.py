import tkinter as tk

def on_generate(event=None):
    pass

root = tk.Tk()
root.title("Meowl")
root.geometry("450x350")
root.resizable(False, False)

font_label = ("Arial", 11, "bold")
font_entry = ("Arial", 11)

tk.Label(root, text="Topic Principal:", font=font_label).pack(pady=(25, 5))
entry_topic = tk.Entry(root, width=45, font=font_entry)
entry_topic.pack()

tk.Label(root, text="Subtopice (separate prin virgulă):", font=font_label).pack(pady=(15, 5))
entry_subtopics = tk.Entry(root, width=45, font=font_entry)
entry_subtopics.pack()

tk.Label(root, text="Durată Video (minute, max 30):", font=font_label).pack(pady=(15, 5))
entry_minutes = tk.Entry(root, width=15, font=font_entry)
entry_minutes.pack()

btn_generate = tk.Button(root, text="Generează Video", font=("Arial", 12, "bold"), bg="#3b82f6", fg="white", command=on_generate)
btn_generate.pack(pady=30)

root.bind('<Return>', on_generate)