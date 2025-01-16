import React, { FormEvent, useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme'; 
import { io, Socket } from 'socket.io-client';
import { useDispatch } from 'react-redux';


// import { GET_ALL_CHATS, UPDATE_CHATS } from '../../store/slice';
// import { IconRead, IconTick } from '../../UI_Component/Icons';
export interface IChat {
    _id: string;
    participants: IParticipants[];
  }
  
  export interface IParticipants {
    userId: string,
    title: string
  }
interface Message {
    _id: string;
    content: string;
    senderId: string;
    timestamp?: Date;
    status?: 'sent' | 'delivered' | 'read'
}
const Chat = () => {
    // const chat = location.state as IChat;
    // const { token, data, isloading } = useAppSelector(state => state.page);
    const [chatId, setChatId] = useState(chat?._id || "")
    const [chats, setChats] = useState(data.user.chats)
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const dispatch = useDispatch()
    const chatListRef = useRef<HTMLUListElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const messagesRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        dispatch(GET_ALL_CHATS()) 
    }, [])

    useEffect(() => {
        if (!chat && data.user.chats.length) {
            setChatId(data.user?.chats[0]?._id)
            setChats(data.user.chats)
        }
    }, [data.user.chats])


    useEffect(() => {
        if (chatListRef.current) {
            // const activeChatElement = chatListRef.current.querySelector(`li[data-chat-id="${chatId}"]`);
            const listItems = chatListRef.current.children;
            const activeChatElement = Array.from(listItems).find(
                (item) => item.getAttribute('data-chat-id') === chatId
            );
            if (activeChatElement) {
                activeChatElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [chatId]);

    useEffect(() => {
        socketRef.current = io(process.env.REACT_APP_API_URL, {
            transports: ['polling', 'websocket'],
            withCredentials: true,
            extraHeaders: {
                Authorization: `Bearer ${token}`

            },
            query: { chatId }
        });

        socketRef.current.on("connect_error", (err) => {
            console.log("Ошибка подключения к сокету:", err);
        });

        const socket = socketRef.current;

        socket.on("connect", () => {
            console.log("Сокет подключен:", socket.id);
            socket.emit("join room", chatId);
        });

        socket.on("previous messages", (previousMessages: Message[]) => {
            console.log("Получены предыдущие сообщения:", previousMessages);
            setMessages(previousMessages);

            const lastUnreadIndex = previousMessages
                .slice()
                .reverse()
                .findIndex(message => message.status === 'read');

            if (lastUnreadIndex !== undefined) {
                for (let i = previousMessages.length - lastUnreadIndex; i < previousMessages.length; i++) {
                    if (previousMessages[i].status !== 'read' && previousMessages[i].senderId !== data.user._id) {
                        handleMessageRead(previousMessages[i]._id);
                    }
                }
            }
        });

        socket.on("chat message", (msg: Message) => {
            console.log("Получено сообщение:", msg);
            if (msg.senderId === data.user._id) {
                setMessages((prevMessages) => [...prevMessages.slice(0, prevMessages.length - 1), msg]);
                // setMessages((prevMessages) => prevMessages.map(message =>
                //     (message.tempId && message.tempId === msg?.tempId) ? msg : message));
            } else {
                setMessages((prevMessages) => [...prevMessages, msg]);
            }

            if (msg.senderId !== data.user._id && !document.hidden) {
                handleMessageRead(msg._id);
            }
        });

        socket.on("new chat", (newChat: IChat) => {
            console.log("Получен новый чат:", newChat);
            dispatch(UPDATE_CHATS(newChat))
        });

        socket.on("message status updated", (data) => {
            console.log(`Сообщение ${data.messageId} было прочитано пользователем ${data.userId}`);
            setMessages((prevMessages) =>
                prevMessages.map(message =>
                    message._id === data.messageId ? { ...message, status: 'read' } : message
                )
            );
        });

        return () => {
            socket.disconnect();
        };
    }, [token, data, chatId]);

    const handleMessageRead = (messageId: string) => {
        if (socketRef.current) {
            socketRef.current.emit("message read", messageId);
        }
    };

    useEffect(() => {
        if (messagesRef.current) {
            messagesRef.current.scrollBy(0, messagesRef.current.scrollHeight);
            // messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // setTimeout(() => {   // Искусственная задержка 
        if (inputValue.trim() && socketRef.current) {
            const message: Message = {
                _id: Math.random().toString(36).substring(2, 15),
                content: inputValue,
                senderId: data.user._id
            };
            setMessages((prevMessages) => [...prevMessages, message]);
            socketRef.current.emit("chat message", inputValue);
            setInputValue('');
        }
        // }, 500)

    };

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                messages.forEach(message => {
                    if (message.status !== 'read' && message.senderId !== data.user._id) {
                        handleMessageRead(message._id);
                    }
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [messages]);

    if (isLoading) {
        return (
          <View style={styles.wrapper}>
            <Text>Loading...</Text>
          </View>
        );
      }
    
      return (
        <View style={styles.wrapper}>
          <View style={styles.chatListWrapper}>
            <FlatList
              data={chats}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <Text
                  style={item._id === chatId ? styles.chatNameActive : styles.chatName}
                  onPress={() => setChatId(item._id)}
                >
                  {item.participants.find(i => i.userId === data.user._id)?.title}
                </Text>
              )}
              ref={chatListRef}
            />
          </View>
          <View style={styles.chatMessagesWrapper}>
            <View ref={messagesRef} style={styles.chatMessages}>
              {!chats.length && (
                <View style={styles.noMessages}>
                  <Text>У вас пока нет ни одного чата</Text>
                  <Text>Начните общение</Text>
                </View>
              )}
              {chats.length && !messages.length && (
                <View style={styles.noMessages}>
                  <Text>Идет загрузка чата...</Text>
                </View>
              )}
              <FlatList
                data={messages}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <Text style={item.senderId === data.user._id ? styles.userMessage : styles.message}>
                    {item.content}
                    {item.senderId === data.user._id && (
                      item.status === "sent" ? <IconRead /> :
                      item.status === "read" ? <IconRead fill={"#005bff"} /> : <IconTick />
                    )}
                  </Text>
                )}
              />
            </View>
            <View style={styles.chatForm}>
              <TextInput
                style={styles.input}
                placeholder="Введите сообщение"
                value={inputValue}
                onChangeText={setInputValue}
              />
              <Button title="Отправить" onPress={sendMessage} />
            </View>
          </View>
        </View>
      );
    };
    
    const styles = StyleSheet.create({
      wrapper: {
        flex: 1,
        padding: 10,
      },
      chatListWrapper: {
        flex: 1,
      },
      chatName: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
      },
      chatNameActive: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        backgroundColor: '#e0e0e0',
      },
      chatMessagesWrapper: {
        flex: 2,
      },
      chatMessages: {
        flex: 1,
      },
      noMessages: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
      },
      userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#d1e7dd',
        padding: 10,
        marginVertical: 5,
        borderRadius: 5,
      },
      message: {
        alignSelf: 'flex-start',
        backgroundColor: '#f8d7da',
        padding: 10,
        marginVertical: 5,
        borderRadius: 5,
      },
      chatForm: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
      },
      input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        marginRight: 10,
        borderRadius: 5,
      },
    });
    
    export default Chat;